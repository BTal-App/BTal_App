// Conversiones entre métrico (kg, cm) e imperial (lb, in) y formateo
// con la unidad correcta según la preferencia del usuario.
//
// Internamente la app SIEMPRE almacena los valores en métrico
// (peso en kg, altura en cm). La conversión solo ocurre al mostrar
// y al leer del input cuando el usuario edita en imperial.

export type UnitsSystem = 'metric' | 'imperial';
export type WeekStart = 'monday' | 'sunday';

// ── Pesos ─────────────────────────────────────────────────────
const KG_PER_LB = 0.45359237;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

// ── Alturas ───────────────────────────────────────────────────
const CM_PER_IN = 2.54;

export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const inToCm = (inches: number): number => inches * CM_PER_IN;

// Convierte cm a un par {feet, inches} para mostrar al estilo USA (5'10").
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToIn(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // Casos borde: si redondea a 12, súmalo a feet
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

// ── Formato amigable ──────────────────────────────────────────

// "75 kg" o "165 lb"
export function formatWeight(kg: number | null | undefined, system: UnitsSystem): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return '—';
  if (system === 'imperial') {
    return `${Math.round(kgToLb(kg))} lb`;
  }
  // Métrico: una decimal solo si tiene decimales relevantes
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(1)} kg`;
}

// "178 cm" o "5'10""
export function formatHeight(cm: number | null | undefined, system: UnitsSystem): string {
  if (cm === null || cm === undefined || Number.isNaN(cm)) return '—';
  if (system === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

// ── Días de la semana ─────────────────────────────────────────

// Devuelve los 7 nombres de la semana ordenados según preferencia.
// Útil para renderizar headers de calendario / planes.
export function weekDays(start: WeekStart, locale: string = 'es-ES'): string[] {
  const labels = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const offset = start === 'monday' ? 1 : 0;
  // Usamos los labels capitalizados según el locale; aquí ya en español.
  // El locale queda preparado para i18n futuro.
  void locale;
  const ordered: string[] = [];
  for (let i = 0; i < 7; i++) {
    ordered.push(labels[(i + offset) % 7]);
  }
  return ordered.map((d) => d.charAt(0).toUpperCase() + d.slice(1));
}
