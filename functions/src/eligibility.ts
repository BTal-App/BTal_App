// Elegibilidad server-side · la VERDAD del límite de generaciones.
//
// El cliente (utils/ia.ts) replica esta lógica solo para UX (mostrar/
// ocultar el botón). Aquí está la autoridad real: aunque manipulen el
// frontend, generatePlan re-comprueba todo antes de gastar quota Gemini.
//
// Reglas (espejo de utils/ia.ts + roadmap 7-5):
//   - Pro activo (vence_en > now): ilimitado.
//   - One-off no consumido y vigente: 1 generación extra.
//   - Free: 1 generación por ciclo de 30 días.
//   - El ciclo se resetea aquí mismo si han pasado >30 días desde ciclo_inicio.

import type { GeneracionesIA, PlanIA } from './types.js';

const CICLO_MS = 30 * 24 * 60 * 60 * 1000;

export type EligibilityDecision =
  | { allowed: true; reason: 'pro' | 'one_off' | 'free'; consumeOneOff: boolean }
  | { allowed: false; reason: 'limit_reached'; unlocksAt: number };

// Devuelve si `generaciones` necesita reset de ciclo (>30 días) y el
// objeto ya reseteado. No escribe · el caller decide persistir.
export function maybeResetCycle(gen: GeneracionesIA, now: number): {
  reset: boolean;
  next: GeneracionesIA;
} {
  if (now - gen.ciclo_inicio > CICLO_MS) {
    return {
      reset: true,
      next: { ...gen, consumidas_ciclo: 0, ciclo_inicio: now },
    };
  }
  return { reset: false, next: gen };
}

export function checkEligibility(
  plan: PlanIA,
  gen: GeneracionesIA,
  now: number,
): EligibilityDecision {
  // Pro vigente → ilimitado.
  if (plan.tipo === 'pro' && plan.vence_en !== null && plan.vence_en > now) {
    return { allowed: true, reason: 'pro', consumeOneOff: false };
  }
  // One-off vigente y no consumido → permitido, marca consumido.
  if (
    plan.tipo === 'one_off' &&
    !plan.one_off_consumido &&
    plan.vence_en !== null &&
    plan.vence_en > now
  ) {
    return { allowed: true, reason: 'one_off', consumeOneOff: true };
  }
  // Free → 1 por ciclo (gen ya viene con el ciclo reseteado si tocaba).
  if (gen.consumidas_ciclo === 0) {
    return { allowed: true, reason: 'free', consumeOneOff: false };
  }
  // Bloqueado · se desbloquea al cumplirse el ciclo.
  return {
    allowed: false,
    reason: 'limit_reached',
    unlocksAt: gen.ciclo_inicio + CICLO_MS,
  };
}

export { CICLO_MS };
