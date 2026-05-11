// Helpers para mapear fechas reales a las claves del schema BTal.
// Usado por HoyPage (filtrar bloque suplementación al día actual),
// MenuPage (resaltar el chip de día de hoy), y donde haga falta.

import type { DayKey } from '../templates/defaultUser';

// Convierte el día de la semana JS (0=domingo, 1=lunes…) a nuestra DayKey.
// Fuente única para que HoyPage y MenuPage no diverjan.
const DAY_OF_WEEK_TO_KEY: Record<number, DayKey> = {
  0: 'dom',
  1: 'lun',
  2: 'mar',
  3: 'mie',
  4: 'jue',
  5: 'vie',
  6: 'sab',
};

export function todayKey(): DayKey {
  return DAY_OF_WEEK_TO_KEY[new Date().getDay()];
}

// Convierte 'YYYY-MM-DD' (zona local) → DayKey ('lun'..'dom'). Usado
// por RegDayPanel para filtrar el selector de plan a solo los días
// del plan que coincidan con el día de la semana de la fecha
// seleccionada en el calendar. Devuelve null si el formato es
// inválido (defensa, no debería ocurrir en la práctica).
export function dayKeyFromFecha(fecha: string): DayKey | null {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  return DAY_OF_WEEK_TO_KEY[dt.getDay()] ?? null;
}

// Fecha de hoy como string YYYY-MM-DD en zona local · se usa para
// comparar contra `last_batido_date` / `last_creatina_date` en
// Suplementos y saber si el suplemento está marcado como "tomado hoy".
// Formato simple sin librería · suficiente para igualdad estricta.
export function todayDateStr(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ISO week key tipo "2026-W18" · igual que v1 `_isoWeekKey`. La ISO
// week empieza en lunes y la semana 1 es la que contiene el primer
// jueves del año. Se usa para auto-resetear el contador semanal de
// creatina cuando el user abre la app y la marca de inicio cae en una
// semana anterior.
export function isoWeekKey(d: Date = new Date()): string {
  // Algoritmo estándar (RFC) · clonamos para no mutar el d original.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Mes-año tipo "2026-05" · usado para auto-reset del contador mensual
// de creatina. Igual que v1 `_ymKey`.
export function monthKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// Año natural tipo "2026" · usado para auto-reset del contador anual
// de batido/creatina. El ciclo va del 1 enero al 31 diciembre.
export function yearKey(d: Date = new Date()): string {
  return String(d.getFullYear());
}

// 'YYYY-MM-DD' → 'YYYY-MM-DD' del día anterior. Parsea como fecha local
// (`new Date(y, m-1, d)`) · el `Date.setDate` maneja correctamente el
// cambio de mes/año y DST. Usado por `useRegistroStats` para iterar la
// racha y por el calendar al navegar día a día.
export function previousDayKey(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayDateStr(dt);
}

// 'YYYY-MM-DD' → 'YYYY-MM-DD' + N días (puede ser negativo). Mismo
// patrón que `previousDayKey` · pasar 1 ≡ siguiente, -1 ≡ previo, etc.
export function addDaysKey(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return todayDateStr(dt);
}
