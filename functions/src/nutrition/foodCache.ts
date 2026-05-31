// Cache de macros de alimentos en Firestore (colección `foods/`).
//
// El backend SOLO LEE de aquí (las escrituras las hace el seed
// `scripts/import-off-foods.mjs` y la función programada `syncOffDeltas`).
// Cada doc `foods/{key}` = macros por 100 g de un alimento, sembradas del dump
// de OpenFoodFacts. La generación del menú resuelve sus alimentos contra este
// cache → cero llamadas a la API de OFF en caliente (sin rate limit).
//
// `normalizeFoodKey` DEBE producir EXACTAMENTE la misma clave que el importador
// (scripts/import-off-foods.mjs replica este algoritmo) · si divergen, no casan.

import type { Firestore } from 'firebase-admin/firestore';

export interface MacrosPer100 {
  kcalPer100: number;
  protPer100: number;
  carbPer100: number;
  fatPer100: number;
  brand?: string;
}

// Palabras de método de cocción / relleno / stopwords que se quitan del nombre
// para casar "Pechuga de pollo a la plancha" con "pollo pechuga". Identidad del
// alimento que no cambian de forma relevante las macros por 100 g.
const STRIP_WORDS = new Set([
  // stopwords
  'de', 'del', 'con', 'sin', 'y', 'e', 'o', 'a', 'al', 'la', 'el', 'los', 'las',
  'un', 'una', 'unos', 'unas', 'en', 'tipo', 'estilo',
  // cocción / preparación
  'plancha', 'horno', 'cocido', 'cocida', 'cocidos', 'cocidas', 'hervido',
  'hervida', 'asado', 'asada', 'asados', 'frito', 'frita', 'salteado',
  'salteada', 'vapor', 'crudo', 'cruda', 'troceado', 'troceada', 'picado',
  'picada', 'rallado', 'rallada', 'rodajas', 'laminado', 'fileteado',
  // relleno
  'fresco', 'fresca', 'natural', 'casero', 'casera', 'ecologico', 'ecologica',
]);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Nombre libre → clave de doc Firestore. Determinista y compartida con el
// importador. Devuelve '' si no queda nada útil (no se cachea/busca).
export function normalizeFoodKey(name: string): string {
  if (!name) return '';
  const base = stripAccents(String(name).toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = base
    .split(' ')
    .filter((t) => t && !STRIP_WORDS.has(t) && t.length > 1)
    .sort(); // orden alfabético → "pollo pechuga" == "pechuga pollo"
  return tokens.join('_');
}

// Lee en batch las macros de un conjunto de claves. Devuelve un Map con el
// dato si el doc existe (y tiene kcal), o null si no está (→ fallback IA).
export async function getMany(
  db: Firestore,
  keys: string[],
): Promise<Map<string, MacrosPer100 | null>> {
  const out = new Map<string, MacrosPer100 | null>();
  const uniq = [...new Set(keys.filter((k) => k.length > 0))];
  if (uniq.length === 0) return out;

  const col = db.collection('foods');
  const refs = uniq.map((k) => col.doc(k));
  // getAll soporta varios refs en una llamada · troceamos por seguridad (300).
  const CHUNK = 300;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const slice = refs.slice(i, i + CHUNK);
    const snaps = await db.getAll(...slice);
    for (const snap of snaps) {
      if (!snap.exists) {
        out.set(snap.id, null);
        continue;
      }
      const d = snap.data() as Partial<MacrosPer100> | undefined;
      if (!d || typeof d.kcalPer100 !== 'number') {
        out.set(snap.id, null);
        continue;
      }
      out.set(snap.id, {
        kcalPer100: d.kcalPer100,
        protPer100: d.protPer100 ?? 0,
        carbPer100: d.carbPer100 ?? 0,
        fatPer100: d.fatPer100 ?? 0,
        brand: d.brand,
      });
    }
  }
  return out;
}
