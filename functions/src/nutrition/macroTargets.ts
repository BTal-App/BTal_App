// Objetivos nutricionales (kcal + macros) · ÚNICA fuente de verdad,
// compartida entre el prompt de la IA (prompt.ts) y el ajuste de raciones
// (enrichMenu.ts). Antes estos factores vivían duplicados en prompt.ts; se
// extrajeron aquí para que el target que se le pide a la IA y el target
// contra el que se ajusta el menú sean EXACTAMENTE el mismo (no se desincronicen).
//
// El cálculo de kcal debe coincidir además con el frontend (utils/calorias.ts):
// Mifflin-St Jeor → TDEE → ajuste ADITIVO ±500. Es lo que el user ve en el
// anillo "Aporte del día" y en Editar perfil.

import type { ValidatedProfile } from '../schemas.js';

const ACTIVITY_FACTOR: Record<ValidatedProfile['actividad'], number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

// Ajuste ADITIVO sobre el TDEE (±500 kcal) · DEBE coincidir con el frontend
// (utils/calorias.ts) y con lo que mide el anillo.
const AJUSTE_OBJETIVO: Record<ValidatedProfile['objetivo'], number> = {
  volumen: 500, // superávit ~0,5 kg/semana
  definicion: -500, // déficit ~0,5 kg/semana
  recomposicion: 0, // sin ajuste de kcal (más proteína, no más kcal)
  mantenimiento: 0,
};

// Proteína g/kg según objetivo.
const PROT_FACTOR: Record<ValidatedProfile['objetivo'], number> = {
  volumen: 1.8,
  definicion: 2.2, // más alta para preservar músculo en déficit
  recomposicion: 2.0,
  mantenimiento: 1.6,
};

// Grasa g/kg según objetivo · cubre el suelo hormonal (no bajar de ~0,8) y
// deja el resto de kcal para los carbohidratos.
const FAT_FACTOR: Record<ValidatedProfile['objetivo'], number> = {
  volumen: 1.0,
  definicion: 0.8,
  recomposicion: 0.9,
  mantenimiento: 0.9,
};

// kcal objetivo diario · si el user fijó objetivoKcal lo usa; si no, lo calcula
// (Mifflin-St Jeor → TDEE → ajuste aditivo). Redondea a 10 kcal.
export function calcKcalObjetivo(p: ValidatedProfile): number {
  if (p.objetivoKcal !== null) return p.objetivoKcal;
  const base =
    10 * p.peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'm' ? 5 : -161);
  const tdee = base * ACTIVITY_FACTOR[p.actividad];
  const target = tdee + AJUSTE_OBJETIVO[p.objetivo];
  return Math.round(target / 10) * 10;
}

export interface MacroTargets {
  kcal: number;
  prot: number; // g/día
  fat: number; // g/día
  carb: number; // g/día (resto tras prot y grasa)
}

// Targets completos del día · prot y grasa por g/kg, carbos = lo que sobra
// para cuadrar las kcal (prot×4 + carb×4 + fat×9 ≈ kcal).
export function macroTargets(p: ValidatedProfile): MacroTargets {
  const kcal = calcKcalObjetivo(p);
  const prot = Math.round(p.peso * PROT_FACTOR[p.objetivo]);
  const fat = Math.round(p.peso * FAT_FACTOR[p.objetivo]);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { kcal, prot, fat, carb };
}

export { PROT_FACTOR, FAT_FACTOR };
