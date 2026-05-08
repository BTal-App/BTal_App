// Helpers para mapear fechas reales a las claves del schema BTal.
// Usado por HoyPage (filtrar bloque suplementación al día actual),
// MenuPage (resaltar el chip de día de hoy), y donde haga falta.

import type { DayKey } from '../templates/defaultUser';

// Convierte el día de la semana JS (0=domingo, 1=lunes…) a nuestra DayKey.
// Fuente única para que HoyPage y MenuPage no diverjan.
export function todayKey(): DayKey {
  const map: Record<number, DayKey> = {
    0: 'dom',
    1: 'lun',
    2: 'mar',
    3: 'mie',
    4: 'jue',
    5: 'vie',
    6: 'sab',
  };
  return map[new Date().getDay()];
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
