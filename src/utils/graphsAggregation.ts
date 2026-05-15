// Helpers para agrupar registros por periodo (ISO week / mes / año)
// y producir los datasets que consume `BarChart` / `LineChart` en el
// `GraphsModal`.

import type { RegistroDia, SupHistoryEntry } from '../templates/defaultUser';
import { addDaysKey, isoWeekKey, todayDateStr } from './dateKeys';

// Devuelve el lunes de la ISO week en la que cae `d` (en local time).
function mondayOfISOWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay() || 7; // domingo = 7
  dt.setDate(dt.getDate() - (day - 1));
  return dt;
}

// Etiqueta corta de una semana ISO · "S20" (semana 20). El año se
// omite si es el actual; si es otro año, "S20·26".
function shortISOWeekLabel(d: Date, currentYear: number): string {
  const key = isoWeekKey(d); // "2026-W18"
  const [y, w] = key.split('-W');
  const yearNum = parseInt(y, 10);
  const weekNum = parseInt(w, 10);
  return yearNum === currentYear
    ? `S${weekNum}`
    : `S${weekNum}·${String(yearNum).slice(-2)}`;
}

// Cuántos entrenos (plan != '' && plan != 'rest') por ISO week en
// las últimas N semanas (incluyendo la actual). Útil para el bar
// chart "Entrenos por semana" del GraphsModal.
export function entrenosPorSemana(
  registros: RegistroDia[],
  semanas: number = 12,
): { label: string; value: number }[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const out: { label: string; value: number; highlight?: 'gold' | null }[] = [];

  // Set de ISO weeks que vamos a mostrar · construido andando hacia
  // atrás semana a semana desde la actual.
  const weekKeys: { key: string; date: Date }[] = [];
  const cursor = mondayOfISOWeek(today);
  for (let i = 0; i < semanas; i++) {
    const dt = new Date(cursor);
    dt.setDate(dt.getDate() - i * 7);
    weekKeys.push({ key: isoWeekKey(dt), date: dt });
  }
  weekKeys.reverse(); // orden cronológico ascendente · más viejo a la izquierda

  // Agregamos los registros por week-key.
  const counts: Record<string, number> = {};
  for (const r of registros) {
    if (!r.fecha || !r.plan || r.plan === 'rest') continue;
    const [y, m, d] = r.fecha.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const k = isoWeekKey(dt);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  for (const w of weekKeys) {
    out.push({
      label: shortISOWeekLabel(w.date, currentYear),
      value: counts[w.key] ?? 0,
    });
  }
  return out;
}

// ── Historial de rachas ────────────────────────────────────────────
//
// Recorre los registros cronológicamente identificando cada tramo de
// entrenos consecutivos (una "racha"). Misma regla que
// `useRegistroStats.calcRacha`: solo entrenos cuentan · descanso o
// vacío rompen · grace period solo para HOY vacío (la racha actual
// sigue abierta si hoy aún no se ha registrado nada pero ayer entrenó).
//
// Usado por la tab "Rachas" del GraphsModal · bar chart con las
// mejores rachas + racha actual destacada.

export interface StreakInterval {
  start: string;   // 'YYYY-MM-DD' · primer entreno de la racha
  end: string;     // 'YYYY-MM-DD' · último entreno de la racha
  length: number;  // días consecutivos entrenando
  endedBy: 'rest' | 'empty' | 'active'; // qué la cerró ('active' = sigue viva)
}

export function calcRachaHistory(registros: RegistroDia[]): StreakInterval[] {
  const trainingSet = new Set<string>();
  const restSet = new Set<string>();
  for (const r of registros) {
    if (!r.fecha || r.plan === '') continue;
    if (r.plan === 'rest') restSet.add(r.fecha);
    else trainingSet.add(r.fecha);
  }
  if (trainingSet.size === 0) return [];

  const today = todayDateStr();
  // El primer entreno (más antiguo) marca el inicio del barrido.
  const firstDay = [...trainingSet].sort()[0];

  const streaks: StreakInterval[] = [];
  let runStart: string | null = null;
  let runEnd: string | null = null;
  let runLen = 0;

  const closeRun = (endedBy: 'rest' | 'empty' | 'active') => {
    if (runStart !== null && runEnd !== null) {
      streaks.push({ start: runStart, end: runEnd, length: runLen, endedBy });
    }
    runStart = null;
    runEnd = null;
    runLen = 0;
  };

  // Iteración día a día desde el primer entreno hasta hoy (inclusive).
  // Comparación de strings 'YYYY-MM-DD' es lexicográfica = cronológica.
  let cursor = firstDay;
  while (cursor <= today) {
    if (trainingSet.has(cursor)) {
      if (runStart === null) runStart = cursor;
      runEnd = cursor;
      runLen++;
    } else if (cursor === today && !restSet.has(cursor)) {
      // HOY vacío → grace · NO cerramos · la racha sigue abierta para
      // marcarse 'active' al salir del bucle (el user puede entrenar
      // más tarde hoy). No-op intencional.
    } else {
      // Día pasado con rest/empty · o HOY con descanso explícito →
      // cierra la racha en curso (si la hay).
      if (runStart !== null) {
        closeRun(restSet.has(cursor) ? 'rest' : 'empty');
      }
    }
    cursor = addDaysKey(cursor, 1);
  }

  // Racha que sigue abierta al llegar a hoy → activa.
  if (runStart !== null) closeRun('active');

  // Mejor racha primero · empate → la más reciente arriba (end desc).
  streaks.sort((a, b) => b.length - a.length || b.end.localeCompare(a.end));
  return streaks;
}

// Tabla plana de PRs ordenada por kg desc · cada entry tiene el
// nombre del ejercicio (legible · capitalizado) y los kg. Las keys
// del map vienen normalizadas (lowercase) · re-capitalizamos para
// mostrar (Title Case por palabra).
export interface PRRow {
  exercise: string; // capitalizado para mostrar
  kg: number;
  fecha: string;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export function prsTable(prs: Record<string, { kg: number; fecha: string }>): PRRow[] {
  const rows: PRRow[] = [];
  for (const [name, pr] of Object.entries(prs)) {
    rows.push({
      exercise: titleCase(name),
      kg: pr.kg,
      fecha: pr.fecha,
    });
  }
  rows.sort((a, b) => b.kg - a.kg);
  return rows;
}

// Convierte el `exerciseHistory[exNorm]` en datos para LineChart ·
// label corto "5 may" + value en kg.
export interface ExerciseHistoryPoint {
  label: string;
  value: number;
}

const MES_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function exerciseHistoryAsPoints(
  history: { fecha: string; maxKg: number }[],
): ExerciseHistoryPoint[] {
  return history
    .filter((h) => h.maxKg > 0)
    .map((h) => {
      const [, m, d] = h.fecha.split('-').map(Number);
      const label = `${d} ${MES_SHORT[(m - 1) || 0]}`;
      return { label, value: h.maxKg };
    });
}

// Lista de ejercicios disponibles para el selector · ordenados por
// nº de sesiones registradas desc, luego alfabético.
export interface ExerciseOption {
  exNorm: string;        // key normalizada
  exDisplay: string;     // capitalizado
  sessions: number;
}

export function exerciseOptions(
  exerciseHistory: Record<string, { fecha: string; maxKg: number }[]>,
): ExerciseOption[] {
  const out: ExerciseOption[] = [];
  for (const [exNorm, history] of Object.entries(exerciseHistory)) {
    out.push({
      exNorm,
      exDisplay: titleCase(exNorm),
      sessions: history?.length ?? 0,
    });
  }
  out.sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return a.exDisplay.localeCompare(b.exDisplay);
  });
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Agregación de SupHistoryEntry[] (Sub-fase 2E.1) por periodo · usado
// por la tab Suplementación del GraphsModal con su selector de
// período (Día / Semana / Mes / Año).

export type SupPeriod = 'day' | 'week' | 'month' | 'year';

const MES_SHORT_ESP = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

// Devuelve la suma de tomas agregadas por bucket del periodo elegido,
// con buckets vacíos rellenados con 0 para que el bar chart siempre
// tenga la misma longitud de eje X (mejor lectura visual).
//
// Buckets:
//   - 'day'   → últimos 14 días
//   - 'week'  → últimas 12 ISO weeks
//   - 'month' → últimos 12 meses
//   - 'year'  → últimos 3 años
export function aggregateSupHistory(
  history: SupHistoryEntry[] | undefined,
  period: SupPeriod,
): { label: string; value: number }[] {
  const today = new Date();
  const safeHistory = history ?? [];

  if (period === 'day') {
    const days = 14;
    const out: { label: string; value: number }[] = [];
    const counts: Record<string, number> = {};
    for (const h of safeHistory) counts[h.fecha] = (counts[h.fecha] ?? 0) + h.count;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = todayDateStr(date);
      const label = `${date.getDate()} ${MES_SHORT_ESP[date.getMonth()]}`;
      out.push({ label, value: counts[key] ?? 0 });
    }
    return out;
  }

  if (period === 'week') {
    const weeks = 12;
    const out: { label: string; value: number }[] = [];
    const counts: Record<string, number> = {};
    for (const h of safeHistory) {
      const [y, m, d] = h.fecha.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const wkey = isoWeekKey(dt);
      counts[wkey] = (counts[wkey] ?? 0) + h.count;
    }
    for (let i = weeks - 1; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7);
      const wkey = isoWeekKey(dt);
      const w = wkey.split('-W')[1];
      out.push({ label: `S${parseInt(w, 10)}`, value: counts[wkey] ?? 0 });
    }
    return out;
  }

  if (period === 'month') {
    const months = 12;
    const out: { label: string; value: number }[] = [];
    const counts: Record<string, number> = {};
    for (const h of safeHistory) {
      const mkey = h.fecha.slice(0, 7); // 'YYYY-MM'
      counts[mkey] = (counts[mkey] ?? 0) + h.count;
    }
    for (let i = months - 1; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;
      out.push({ label: MES_SHORT_ESP[dt.getMonth()], value: counts[key] ?? 0 });
    }
    return out;
  }

  // 'year' · últimos 3 años (el cap del schema es ~366 días así que
  // máximo 1-2 años con datos · el 3º normalmente está vacío hasta
  // que el user lleve tiempo usando la app).
  const years = 3;
  const out: { label: string; value: number }[] = [];
  const counts: Record<string, number> = {};
  for (const h of safeHistory) {
    const ykey = h.fecha.slice(0, 4);
    counts[ykey] = (counts[ykey] ?? 0) + h.count;
  }
  for (let i = years - 1; i >= 0; i--) {
    const y = today.getFullYear() - i;
    out.push({ label: String(y), value: counts[String(y)] ?? 0 });
  }
  return out;
}

// Devuelve la suma TOTAL de tomas en todo el histórico · útil para
// mostrar el badge "X tomas en {periodo}" debajo del chart.
export function sumSupHistory(history: SupHistoryEntry[] | undefined): number {
  if (!history?.length) return 0;
  return history.reduce((s, e) => s + e.count, 0);
}

// Etiqueta humana del periodo · para el "Total {periodo}" debajo.
export const SUP_PERIOD_LABEL: Record<SupPeriod, string> = {
  day:   'últimos 14 días',
  week:  'últimas 12 semanas',
  month: 'últimos 12 meses',
  year:  'últimos 3 años',
};
