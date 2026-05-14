import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { getRegistrosRecientes } from '../services/db';
import {
  defaultRegistroStats,
  type ExerciseHistoryEntry,
  type PRStat,
  type RegistroDia,
} from '../templates/defaultUser';
import { previousDayKey, todayDateStr } from '../utils/dateKeys';

// Stats agregados que muestra el StatsGrid de RegistroPage:
//   - totalEntrenos · cuenta de días con registro (entreno + descanso).
//   - prsTotal · número de ejercicios distintos con un PR.
//   - racha · días consecutivos hasta hoy/ayer (calculada on-the-fly).
//   - prs · map ejercicio normalizado → { kg, fecha }.
//   - exerciseHistory · map ejercicio normalizado → últimos N puntos
//     para el sparkline del RegDayPanel.
//
// `totalEntrenos`, `prs` y `exerciseHistory` salen del UserDocument
// (mantenidos por la transacción en setRegistroDia/deleteRegistroDia).
// La racha se calcula en este hook leyendo los últimos `RACHA_FETCH_LIMIT`
// días de /registros · una sola query al montar · refrescada manualmente
// (`refresh()`) tras guardar/borrar para reflejar la nueva racha sin
// esperar al re-mount del componente.

// Tope práctico de docs a leer para el cálculo de racha. Subido de 60 a
// 999 · cubre rachas de hasta ~2.7 años consecutivos · poco probable que
// nadie llegue, pero el cap a 60 limitaba el número visible a 60 incluso
// si el user tenía más días seguidos. Firestore `limit()` es un máximo ·
// users con menos registros no consumen reads extra (solo lee los que
// existen). Cost · gratis hasta 50K reads/día en free tier, irrelevante
// para Blaze con budgets bajos.
const RACHA_FETCH_LIMIT = 999;

export interface UseRegistroStatsResult {
  totalEntrenos: number;
  prsTotal: number;
  prs: Record<string, PRStat>;
  exerciseHistory: Record<string, ExerciseHistoryEntry[]>;
  racha: { actual: number; ultimaFecha: string | null };
  loading: boolean;
  // Re-fetch de los registros recientes · para llamarse después de
  // guardar/borrar y forzar recálculo inmediato de la racha sin
  // depender de una nueva suscripción.
  refresh: () => Promise<void>;
}

// Calcula la racha de días consecutivos contando desde hoy hacia
// atrás. Cuenta cualquier día con `plan != ''` (entrenamiento o
// descanso explícito · ambos son adherencia al plan).
//
// Reglas:
//  - Si hoy tiene registro · racha empieza en hoy.
//  - Si hoy NO tiene pero ayer SÍ · racha empieza en ayer.
//  - Si ni hoy ni ayer tienen · racha = 0.
//  - Iteramos hacia atrás mientras haya registros consecutivos · al
//    primer hueco paramos.
function calcRacha(
  registros: RegistroDia[],
): { actual: number; ultimaFecha: string | null } {
  const fechaSet = new Set<string>();
  for (const r of registros) {
    if (r.plan !== '') fechaSet.add(r.fecha);
  }
  if (fechaSet.size === 0) return { actual: 0, ultimaFecha: null };

  const today = todayDateStr();
  const yesterday = previousDayKey(today);

  let cursor: string;
  if (fechaSet.has(today)) cursor = today;
  else if (fechaSet.has(yesterday)) cursor = yesterday;
  else return { actual: 0, ultimaFecha: null };

  const ultimaFecha = cursor;
  let actual = 0;
  while (fechaSet.has(cursor)) {
    actual++;
    cursor = previousDayKey(cursor);
  }
  return { actual, ultimaFecha };
}

export function useRegistroStats(): UseRegistroStatsResult {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const uid = user?.uid ?? null;
  const stats = userDoc?.registroStats ?? defaultRegistroStats();

  const [recientes, setRecientes] = useState<RegistroDia[]>([]);
  const [loading, setLoading] = useState(true);

  // Función estable para refresh manual desde fuera (post-save/delete).
  // No la metemos en useCallback porque el caller la guarda con useEvent
  // (en ProfileProvider futuro) o la llama directamente en handlers.
  const fetchRecientes = async () => {
    if (!uid) {
      setRecientes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const arr = await getRegistrosRecientes(uid, RACHA_FETCH_LIMIT);
      setRecientes(arr);
    } catch (err) {
      console.warn('[useRegistroStats] fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    // Sync con Firestore · setState al montar y al cambiar uid es la
    // lectura inicial. Mismo patrón que useRegistroMes.
    if (!uid) {
      setRecientes([]);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getRegistrosRecientes(uid, RACHA_FETCH_LIMIT)
      .then((arr) => {
        if (mounted) setRecientes(arr);
      })
      .catch((err) => {
        console.warn('[useRegistroStats] fetch failed', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [uid]);

  const racha = useMemo(() => calcRacha(recientes), [recientes]);

  return {
    totalEntrenos: stats.totalEntrenos,
    prsTotal: Object.keys(stats.prs).length,
    prs: stats.prs,
    exerciseHistory: stats.exerciseHistory,
    racha,
    loading,
    refresh: fetchRecientes,
  };
}
