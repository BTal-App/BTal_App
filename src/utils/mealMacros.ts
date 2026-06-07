// Recálculo de macros de una comida a partir de sus alimentos (Fase 6B-B).
// Solo cuentan los alimentos que llevan macros reales por 100 g (`kcalPer100`,
// del buscador/barcode de OpenFoodFacts) Y cantidad parseable a gramos. Los
// alimentos tecleados a mano (sin macros) no aportan al cálculo automático.
//
// El editor de comidas usa esto para ajustar el total de la comida cuando se
// añade/edita/quita un alimento con macros, preservando el "extra manual"
// (lo que el user haya tecleado a mano en los campos de macros) vía DELTAS.

import { parseQuantity } from './quantity';
import type { Alimento } from '../templates/defaultUser';

export interface Macros {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

// Macros de UN alimento con datos (per100 + gramos). null si no aplica.
function alimentoMacros(a: Alimento): Macros | null {
  if (typeof a.kcalPer100 !== 'number') return null;
  const { grams } = parseQuantity(a.cantidad);
  if (grams == null) return null;
  const f = grams / 100;
  return {
    kcal: Math.round(a.kcalPer100 * f),
    prot: Math.round((a.protPer100 ?? 0) * f),
    carb: Math.round((a.carbPer100 ?? 0) * f),
    fat: Math.round((a.fatPer100 ?? 0) * f),
  };
}

// Suma de macros de los alimentos CON datos. Los manuales no suman.
export function macrosFromAlimentos(alimentos: Alimento[]): Macros {
  const t: Macros = { kcal: 0, prot: 0, carb: 0, fat: 0 };
  for (const a of alimentos) {
    const m = alimentoMacros(a);
    if (m) {
      t.kcal += m.kcal;
      t.prot += m.prot;
      t.carb += m.carb;
      t.fat += m.fat;
    }
  }
  return t;
}
