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
//   - racha · días consecutivos ENTRENANDO hasta hoy/ayer · solo entrenos
//     (descansos y vacíos rompen) · calculada on-the-fly.
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

// Calcula la racha de días consecutivos ENTRENANDO contando desde hoy
// hacia atrás. SOLO cuentan días con entreno · los descansos y los días
// vacíos rompen la racha (decisión de producto · la racha es un challenge
// de entrenamiento continuo, no un tracker de adherencia al plan).
//
// Formato de `RegistroDia.plan`:
//   - 'PLANID|DAYINDEX' (ej '4dias|0')  → ENTRENO  · cuenta
//   - 'rest'                            → DESCANSO · rompe
//   - ''                                → VACÍO    · rompe
//
// Reglas:
//  - Día con entreno         → cuenta · suma +1 · sigue hacia atrás.
//  - Día con descanso        → ROMPE (incluso si es HOY · sin grace ·
//    es una decisión activa del user de no entrenar).
//  - Día vacío               → ROMPE, EXCEPTO si es HOY: grace period ·
//    si ayer entrenó, la racha refleja el valor de ayer hasta medianoche
//    (el user aún puede entrenar hoy más tarde).
//  - Inicio: el primer entreno registrado da racha = 1.
function calcRacha(
  registros: RegistroDia[],
): { actual: number; ultimaFecha: string | null } {
  const trainingSet = new Set<string>();
  const restSet = new Set<string>();
  for (const r of registros) {
    if (r.plan === '') continue;
    if (r.plan === 'rest') restSet.add(r.fecha);
    else trainingSet.add(r.fecha);
  }
  if (trainingSet.size === 0) return { actual: 0, ultimaFecha: null };

  const today = todayDateStr();
  const yesterday = previousDayKey(today);

  // Estado de un día: 'training' cuenta · 'rest'/'empty' rompen.
  type DayStatus = 'training' | 'rest' | 'empty';
  const statusOf = (d: string): DayStatus => {
    if (trainingSet.has(d)) return 'training';
    if (restSet.has(d)) return 'rest';
    return 'empty';
  };

  // Punto de partida con grace period limitado a HOY vacío:
  //  - Hoy entreno          → empezamos hoy.
  //  - Hoy descanso         → break inmediato (sin grace · racha 0).
  //  - Hoy vacío + ayer ent → grace · empezamos en ayer.
  //  - Resto                → racha 0.
  let cursor: string;
  const todaySt = statusOf(today);
  if (todaySt === 'training') {
    cursor = today;
  } else if (todaySt === 'rest') {
    return { actual: 0, ultimaFecha: null };
  } else if (statusOf(yesterday) === 'training') {
    cursor = yesterday;
  } else {
    return { actual: 0, ultimaFecha: null };
  }

  const ultimaFecha = cursor;
  let actual = 0;
  // Hacia atrás · solo 'training' continúa · 'rest'/'empty' rompen igual.
  while (statusOf(cursor) === 'training') {
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
