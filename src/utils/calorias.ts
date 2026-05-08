// Cálculo de objetivo calórico diario.
//
// Fórmula:
//   1. BMR (Mifflin-St Jeor 1990) — la más usada en nutrición clínica:
//      Hombre: BMR = 10·peso + 6.25·altura − 5·edad + 5
//      Mujer:  BMR = 10·peso + 6.25·altura − 5·edad − 161
//   2. TDEE = BMR × factor de actividad
//   3. Objetivo = TDEE + ajuste por meta (volumen +500, definición −500,
//      recomp 0 o leve déficit, mantenimiento 0)
//
// El resultado es un número en kcal/día redondeado a la decena más cercana.
// La UI lo muestra pero el user puede sobrescribirlo manualmente desde
// Editar perfil — se guarda en `profile.objetivoKcal`.

import type { NivelActividad, Objetivo, Sexo, UserProfile } from '../templates/defaultUser';

// Multiplicador para pasar de BMR a TDEE (Total Daily Energy Expenditure).
const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

// Ajuste de kcal sobre el TDEE según el objetivo del user.
// Volumen y definición usan ±500 (estándar de nutrición deportiva,
// ≈0.5 kg/semana). Recomposición es ±0 con ligero déficit estructural
// (más proteína, no más kcal). Mantenimiento es 0.
const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  volumen: 500,
  definicion: -500,
  recomposicion: 0,
  mantenimiento: 0,
};

// Calcula el objetivo de kcal/día sugerido a partir del perfil. Devuelve
// null si faltan datos básicos (edad, peso, altura, sexo, actividad,
// objetivo) — la UI debe mostrar un fallback "—" en ese caso.
export function calcularObjetivoKcal(profile: UserProfile): number | null {
  const { edad, peso, altura, sexo, actividad, objetivo } = profile;
  if (
    edad === null
    || peso === null
    || altura === null
    || sexo === null
    || actividad === null
    || objetivo === null
  ) {
    return null;
  }

  const bmr = mifflinStJeor(peso, altura, edad, sexo);
  const tdee = bmr * FACTOR_ACTIVIDAD[actividad];
  const objetivoKcal = tdee + AJUSTE_OBJETIVO[objetivo];

  // Redondeo a la decena más cercana — los kcal medios no aportan
  // precisión real, solo ruido visual ("2.043" vs "2.040").
  return Math.round(objetivoKcal / 10) * 10;
}

function mifflinStJeor(pesoKg: number, alturaCm: number, edad: number, sexo: Sexo): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  return sexo === 'm' ? base + 5 : base - 161;
}

// Devuelve el objetivo "efectivo" del user · si tiene uno manual lo usa,
// si no, calcula el sugerido. Es lo que la UI debe mostrar y lo que la
// IA debe usar como referencia. Componentes consumidores: MenuPage (ring),
// AiPromptSummaryModal (resumen), Cloud Function `generatePlan` (Fase 6).
export function objetivoKcalEfectivo(profile: UserProfile | undefined | null): number | null {
  if (!profile) return null;
  if (profile.objetivoKcal !== null) return profile.objetivoKcal;
  return calcularObjetivoKcal(profile);
}
