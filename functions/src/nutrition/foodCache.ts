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

// Resultado del buscador (6B-B) · macros + nombre legible + barcode.
export interface FoodResult extends MacrosPer100 {
  nombre: string;
  code?: string;
  source: 'off';
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

// Tokens normalizados de un nombre (para búsqueda por nombre en `foods/`,
// 6B-B). NO ordenados (a diferencia de normalizeFoodKey) · deduplicados ·
// cap a 12. Compartido con el seed/sync (se guardan en el campo `tokens`).
export function tokenize(name: string): string[] {
  if (!name) return [];
  const base = stripAccents(String(name).toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of base.split(' ')) {
    if (t.length > 1 && !STRIP_WORDS.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= 12) break;
    }
  }
  return out;
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

// Doc de `foods/` → FoodResult (para el buscador). null si no es válido.
function docToResult(d: Record<string, unknown>): FoodResult | null {
  if (typeof d.kcalPer100 !== 'number') return null;
  const nombre = typeof d.name === 'string' && d.name ? d.name : '';
  if (!nombre) return null;
  return {
    nombre,
    brand: typeof d.brand === 'string' ? d.brand : undefined,
    code: typeof d.code === 'string' && d.code ? d.code : undefined,
    kcalPer100: d.kcalPer100,
    protPer100: typeof d.protPer100 === 'number' ? d.protPer100 : 0,
    carbPer100: typeof d.carbPer100 === 'number' ? d.carbPer100 : 0,
    fatPer100: typeof d.fatPer100 === 'number' ? d.fatPer100 : 0,
    source: 'off',
  };
}

// Busca en el cache por código de barras (campo `code`). 1 resultado.
export async function getByCode(db: Firestore, code: string): Promise<FoodResult | null> {
  const c = code.trim();
  if (!c) return null;
  const snap = await db.collection('foods').where('code', '==', c).limit(1).get();
  if (snap.empty) return null;
  return docToResult(snap.docs[0].data());
}

// Busca en el cache por nombre · `tokens array-contains` el primer token y
// rankea por nº de tokens de la query que casan (+ los productos sin marca
// arriba, suelen ser genéricos más relevantes). Devuelve hasta `limit`.
export async function searchByTokens(
  db: Firestore,
  tokens: string[],
  limit: number,
): Promise<FoodResult[]> {
  if (tokens.length === 0) return [];
  const snap = await db
    .collection('foods')
    .where('tokens', 'array-contains', tokens[0])
    .limit(80)
    .get();
  const scored: { r: FoodResult; score: number }[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const r = docToResult(d);
    if (!r) continue;
    const dt: string[] = Array.isArray(d.tokens) ? d.tokens : [];
    const matches = tokens.filter((t) => dt.includes(t)).length;
    scored.push({ r, score: matches * 10 + (r.brand ? 0 : 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.r);
}
