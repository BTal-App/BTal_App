import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeRegistroMes } from '../services/db';
import type { RegistroDia } from '../templates/defaultUser';

// Suscripción reactiva a los registros de un mes concreto. Cada cambio
// (alta/edición/borrado en /users/{uid}/registros/{YYYY-MM-DD} dentro
// del rango) re-emite el map completo. Usado por RegistroPage para
// pintar las celdas del calendar y por RegDayPanel para leer el día
// seleccionado · al guardar/borrar, la suscripción re-emite y la UI
// queda en sync sin re-fetch manual.
//
// `month0` sigue la convención JS: 0 = enero, 11 = diciembre.

export interface UseRegistroMesResult {
  byDate: Record<string, RegistroDia>;
  loading: boolean;
}

export function useRegistroMes(year: number, month0: number): UseRegistroMesResult {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [byDate, setByDate] = useState<Record<string, RegistroDia>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync con sistema externo (Firestore) · el setState dentro del
    // efecto es la lectura inicial de la suscripción al montar / cambio
    // de uid. Mismo patrón que PreferencesProvider.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!uid) {
      setByDate({});
      setLoading(false);
      return;
    }
    let mounted = true;
    let unsub: (() => void) | null = null;
    setLoading(true);
    setByDate({});
    /* eslint-enable react-hooks/set-state-in-effect */

    subscribeRegistroMes(uid, year, month0, (data) => {
      if (!mounted) return;
      setByDate(data);
      setLoading(false);
    })
      .then((u) => {
        // Si el componente se desmontó antes de que el subscribe resolviera,
        // ejecutamos unsub inmediatamente para no dejar listeners colgando.
        if (!mounted) {
          u();
          return;
        }
        unsub = u;
      })
      .catch((err) => {
        console.warn('[useRegistroMes] subscribe failed', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [uid, year, month0]);

  return { byDate, loading };
}
