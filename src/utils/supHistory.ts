// Helpers puros para mantener `Suplementos.batidoHistory` y
// `creatinaHistory` consistentes al marcar/cancelar/incrementar/
// decrementar tomas desde ProfileProvider.
//
// Las funciones son inmutables · devuelven un array nuevo. El caller
// pasa el resultado a `patchSuplementos` (db.ts) junto con los demás
// counters en una sola escritura atómica.

import {
  SUP_HISTORY_MAX_DAYS,
  type SupHistoryEntry,
} from '../templates/defaultUser';

// Aplica un delta (+1 / -1 / +N) al count de una fecha concreta del
// histórico. Reglas:
//   - Si la fecha ya tiene entry · suma `delta` (clamp ≥ 0). Si llega
//     a 0, elimina la entry para que el array se mantenga bounded.
//   - Si la fecha NO tiene entry y `delta > 0` · crea entry nueva.
//   - Si la fecha NO tiene entry y `delta ≤ 0` · no-op (no podemos
//     decrementar lo que no existe; el counter agregado puede estar
//     desincronizado pero no inventamos history).
//
// Tras el cambio, ordena por fecha asc y trunca a los últimos
// SUP_HISTORY_MAX_DAYS días (1 año). Idempotente: aplicar dos veces
// el mismo delta produce el mismo resultado que aplicar la suma.
export function applySupHistoryDelta(
  history: SupHistoryEntry[] | undefined,
  fecha: string,
  delta: number,
): SupHistoryEntry[] {
  const base = Array.isArray(history) ? history : [];
  const idx = base.findIndex((e) => e.fecha === fecha);

  let next: SupHistoryEntry[];
  if (idx >= 0) {
    const newCount = Math.max(0, base[idx].count + delta);
    if (newCount === 0) {
      next = base.filter((_, i) => i !== idx);
    } else {
      next = base.slice();
      next[idx] = { fecha, count: newCount };
    }
  } else if (delta > 0) {
    next = [...base, { fecha, count: delta }];
  } else {
    return base;
  }

  next.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  if (next.length > SUP_HISTORY_MAX_DAYS) {
    next = next.slice(-SUP_HISTORY_MAX_DAYS);
  }
  return next;
}

// Cuenta total de tomas en un rango [startInc, endInc] · ambos
// inclusive en formato 'YYYY-MM-DD'. Ignora entries fuera del rango.
export function sumSupHistoryRange(
  history: SupHistoryEntry[] | undefined,
  startInc: string,
  endInc: string,
): number {
  if (!history?.length) return 0;
  let total = 0;
  for (const e of history) {
    if (e.fecha >= startInc && e.fecha <= endInc) total += e.count;
  }
  return total;
}
