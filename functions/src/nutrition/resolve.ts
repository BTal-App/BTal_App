// Resuelve las macros REALES (por 100 g) de todos los alimentos de un menú
// leyendo del cache Firestore `foods/` (sembrado del dump de OpenFoodFacts).
//
// CERO llamadas a la API de OFF aquí → sin rate limit. Junta las claves únicas
// del menú (dedup) y hace UNA lectura batch. Lo que no esté en cache devuelve
// null → enrichMenu cae en la macro estimada por la IA para ese alimento.

import type { Firestore } from 'firebase-admin/firestore';
import type { Comida, ComidaExtra, Menu } from '../types.js';
import { DAY_KEYS, MEAL_KEYS } from '../types.js';
import { getMany, normalizeFoodKey, type MacrosPer100 } from './foodCache.js';

// Recorre las 4 comidas fijas + las extras de cada día.
function eachComida(menu: Menu, fn: (c: Comida | ComidaExtra) => void): void {
  for (const day of DAY_KEYS) {
    const dia = menu[day];
    if (!dia) continue;
    for (const meal of MEAL_KEYS) fn(dia[meal]);
    for (const extra of dia.extras ?? []) fn(extra);
  }
}

export async function resolveMenuMacros(
  db: Firestore,
  menu: Menu,
): Promise<Map<string, MacrosPer100 | null>> {
  const keys = new Set<string>();
  eachComida(menu, (c) => {
    for (const a of c.alimentos ?? []) {
      const k = normalizeFoodKey(a.nombre);
      if (k) keys.add(k);
    }
  });
  return getMany(db, [...keys]);
}
