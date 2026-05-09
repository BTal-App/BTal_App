// Helpers de formateo de día de la semana para la tab Entreno y
// componentes relacionados. Centralizados aquí porque exportar utils
// junto con un React.FC default rompe react-refresh (Fast Refresh
// requiere que un archivo exporte SOLO componentes).
//
// Reusamos DAY_LABEL_FULL / DAY_LABEL_SHORT que ya viven en defaultUser
// (DayKey es el código corto: 'lun', 'mar', 'mie', ...).

import {
  DAY_LABEL_FULL,
  DAY_LABEL_SHORT,
  type DayKey,
} from '../templates/defaultUser';

export function formatDiaSemana(d: DayKey | null): string {
  if (!d) return '';
  return DAY_LABEL_FULL[d];
}

export function formatDiaSemanaShort(d: DayKey | null): string {
  if (!d) return '';
  return DAY_LABEL_SHORT[d].toUpperCase();
}

// Lista ordenada de DayKey + label · útil para los <select> de día
// semana en los editores de plan/día.
export const DAY_OPTIONS: { val: DayKey; label: string }[] = (
  ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as DayKey[]
).map((val) => ({ val, label: DAY_LABEL_FULL[val] }));
