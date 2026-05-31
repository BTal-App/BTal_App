// Enriquece el menú con macros REALES (del cache OFF) y AJUSTA los gramos de
// los alimentos escalables para que el total de cada día alcance el objetivo
// de kcal. NO inventa números: usa macros reales por 100 g y sube/baja las
// raciones (lo que haría un nutricionista: "come 90 g de arroz en vez de 60").
//
// Por comida:
//   - Alimento RESUELTO (nombre en cache + cantidad parseable a gramos):
//     macros reales = gramos × macros/100.
//   - Alimento NO resuelto: se conserva como "resto" estimado por la IA (la IA
//     solo da macros a nivel de comida, no por alimento).
//   - Comida 100% resuelta → macros reales puras. Parcial → reales + resto IA.
//     Sin resolver nada → se queda con la estimación IA (no se toca).
//
// Ajuste por día: factor f = (objetivo − kcalFijas − batido) / kcalEscalables,
// clamp [0.5, 2.0]. Escala SOLO los alimentos escalables (peso/volumen), nunca
// las unidades discretas ("1 huevo"). Reescribe la `cantidad` y recalcula macros.

import type { ValidatedProfile } from '../schemas.js';
import type { Comida, ComidaExtra, DayKey, Menu } from '../types.js';
import { DAY_KEYS, MEAL_KEYS } from '../types.js';
import { macroTargets } from './macroTargets.js';
import { normalizeFoodKey, type MacrosPer100 } from './foodCache.js';
import { parseQuantity, rewriteGramsInCantidad } from './quantity.js';

const TOL = 0.05; // margen ±5% · dentro de él no se ajusta
const F_MIN = 0.5;
const F_MAX = 2.0;
const GRAMS_MIN = 5;
const GRAMS_MAX = 1000;

export interface BatidoInfo {
  days: DayKey[];
  kcal: number;
}

interface ScalableFood {
  index: number; // posición en c.alimentos
  grams: number; // gramos actuales (se actualiza al escalar)
  m100: MacrosPer100;
}

interface MealAnalysis {
  resolvedKcal: number;
  resolvedProt: number;
  resolvedCarb: number;
  resolvedFat: number;
  // "resto" IA atribuido a alimentos no resueltos (fijo, no escalable).
  remKcal: number;
  remProt: number;
  remCarb: number;
  remFat: number;
  scalables: ScalableFood[];
}

function analyzeMeal(
  c: Comida | ComidaExtra,
  macrosMap: Map<string, MacrosPer100 | null>,
): MealAnalysis {
  // Las comidas MANUALES del user (incluye alimentos del buscador 6B-B) NO se
  // reajustan ni recalculan · cuentan como FIJAS (su kcal va al total del día
  // pero sus gramos/macros no se tocan). Preserva el trabajo manual del user en
  // una regeneración con "conservar lo mío".
  if (c.source === 'user') {
    return {
      resolvedKcal: 0,
      resolvedProt: 0,
      resolvedCarb: 0,
      resolvedFat: 0,
      remKcal: c.kcal,
      remProt: c.prot,
      remCarb: c.carb,
      remFat: c.fat,
      scalables: [],
    };
  }

  let resolvedKcal = 0;
  let resolvedProt = 0;
  let resolvedCarb = 0;
  let resolvedFat = 0;
  let unresolved = 0;
  const scalables: ScalableFood[] = [];

  (c.alimentos ?? []).forEach((a, index) => {
    const { grams, scalable } = parseQuantity(a.cantidad);
    const m = grams != null ? macrosMap.get(normalizeFoodKey(a.nombre)) ?? null : null;
    if (grams != null && m) {
      resolvedKcal += (grams * m.kcalPer100) / 100;
      resolvedProt += (grams * m.protPer100) / 100;
      resolvedCarb += (grams * m.carbPer100) / 100;
      resolvedFat += (grams * m.fatPer100) / 100;
      if (scalable) scalables.push({ index, grams, m100: m });
    } else {
      unresolved += 1;
    }
  });

  // Si TODO resolvió, no hay resto (macros reales puras). Si quedó algo sin
  // resolver, el resto = lo que falta hasta el total IA (atribuido a esos
  // alimentos, fijo). Si nada resolvió, el resto = todo el total IA.
  const rem =
    unresolved === 0
      ? { remKcal: 0, remProt: 0, remCarb: 0, remFat: 0 }
      : {
          remKcal: Math.max(0, c.kcal - resolvedKcal),
          remProt: Math.max(0, c.prot - resolvedProt),
          remCarb: Math.max(0, c.carb - resolvedCarb),
          remFat: Math.max(0, c.fat - resolvedFat),
        };

  return { resolvedKcal, resolvedProt, resolvedCarb, resolvedFat, ...rem, scalables };
}

export function enrichAndAdjustMenu(
  menu: Menu,
  profile: ValidatedProfile,
  macrosMap: Map<string, MacrosPer100 | null>,
  batido?: BatidoInfo,
): Menu {
  const target = macroTargets(profile).kcal;

  for (const day of DAY_KEYS) {
    const dia = menu[day];
    if (!dia) continue;
    const meals: (Comida | ComidaExtra)[] = [
      ...MEAL_KEYS.map((k) => dia[k]),
      ...(dia.extras ?? []),
    ];
    const analyses = meals.map((c) => analyzeMeal(c, macrosMap));

    const batidoKcal = batido && batido.days.includes(day) ? batido.kcal : 0;

    // Total REAL del día (macros resueltas + resto IA) + batido.
    let dayKcal = batidoKcal;
    let scalableKcal = 0;
    for (const a of analyses) {
      dayKcal += a.resolvedKcal + a.remKcal;
      for (const f of a.scalables) scalableKcal += (f.grams * f.m100.kcalPer100) / 100;
    }

    // Factor de ajuste · solo si hay escalables y estamos fuera del margen.
    let factor = 1;
    if (scalableKcal > 0 && Math.abs(dayKcal - target) / target > TOL) {
      const fixedKcal = dayKcal - scalableKcal;
      factor = (target - fixedKcal) / scalableKcal;
      factor = Math.min(F_MAX, Math.max(F_MIN, factor));
    }

    // Aplica el factor a los escalables + recalcula macros de cada comida.
    meals.forEach((c, mi) => {
      const a = analyses[mi];
      let dKcal = 0;
      let dProt = 0;
      let dCarb = 0;
      let dFat = 0;
      for (const food of a.scalables) {
        const oldG = food.grams;
        const newG = Math.max(GRAMS_MIN, Math.min(GRAMS_MAX, Math.round(oldG * factor)));
        if (newG !== oldG) {
          c.alimentos[food.index].cantidad = rewriteGramsInCantidad(
            c.alimentos[food.index].cantidad,
            newG,
          );
        }
        dKcal += ((newG - oldG) * food.m100.kcalPer100) / 100;
        dProt += ((newG - oldG) * food.m100.protPer100) / 100;
        dCarb += ((newG - oldG) * food.m100.carbPer100) / 100;
        dFat += ((newG - oldG) * food.m100.fatPer100) / 100;
        food.grams = newG;
      }
      // Comida con algo resuelto → escribe macros (reales + resto + ajuste).
      // Comida sin nada resuelto → resolved=0 y rem=total IA → queda igual.
      const hasResolved = a.scalables.length > 0 || a.resolvedKcal > 0;
      if (hasResolved) {
        c.kcal = Math.max(0, Math.round(a.resolvedKcal + a.remKcal + dKcal));
        c.prot = Math.max(0, Math.round(a.resolvedProt + a.remProt + dProt));
        c.carb = Math.max(0, Math.round(a.resolvedCarb + a.remCarb + dCarb));
        c.fat = Math.max(0, Math.round(a.resolvedFat + a.remFat + dFat));
      }
    });
  }

  return menu;
}
