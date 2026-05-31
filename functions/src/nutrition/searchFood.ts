// Callable `searchFood` (Fase 6B-B) · busca alimentos para el editor de comidas.
// CACHE-FIRST: resuelve la mayoría desde `foods/` (25k+ · sync semanal). Solo
// llama a OFF EN VIVO en cache-miss, y cachea el resultado para todos. Así el
// límite 10/min de OFF no es cuello de botella con usuarios concurrentes.
//
// Input  : { query?: string, barcode?: string, supermercados?: string[] }
// Output : { results: FoodResult[] }  (macros/100g + nombre + marca + barcode)

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  getByCode,
  normalizeFoodKey,
  searchByTokens,
  tokenize,
  type FoodResult,
} from './foodCache.js';
import { productByBarcode, searchOff, type OffFood } from './openfoodfacts.js';
import { brandsForSupermercados } from './supermercados.js';

const MAX_RESULTS = 15;

function offToResult(f: OffFood): FoodResult {
  return {
    nombre: f.name,
    brand: f.brand,
    code: f.code,
    kcalPer100: f.kcalPer100,
    protPer100: f.protPer100,
    carbPer100: f.carbPer100,
    fatPer100: f.fatPer100,
    source: 'off',
  };
}

// Cachea en `foods/` (merge) los resultados nuevos de OFF, en un batch.
async function cacheFoods(db: Firestore, foods: OffFood[]): Promise<void> {
  if (foods.length === 0) return;
  const batch = db.batch();
  const col = db.collection('foods');
  const seen = new Set<string>();
  for (const f of foods) {
    const key = normalizeFoodKey(f.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    batch.set(
      col.doc(key),
      {
        name: f.name,
        tokens: tokenize(f.name),
        kcalPer100: f.kcalPer100,
        protPer100: f.protPer100,
        carbPer100: f.carbPer100,
        fatPer100: f.fatPer100,
        brand: f.brand ?? '',
        code: f.code ?? '',
        source: 'off',
        lastModified: 0,
        fetchedAt: Date.now(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

// Mezcla cache + OFF dedup por clave normalizada (cache primero) y aplica boost
// de marca del súper del user (ranking, no filtro).
function mergeAndBoost(
  cacheRes: FoodResult[],
  offRes: FoodResult[],
  supermercados: string[],
): FoodResult[] {
  const seen = new Set<string>();
  const merged: FoodResult[] = [];
  for (const r of [...cacheRes, ...offRes]) {
    const k = normalizeFoodKey(r.nombre);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(r);
  }
  const brands = brandsForSupermercados(supermercados);
  if (brands.size > 0) {
    merged.sort((a, b) => {
      const ba = a.brand && brands.has(a.brand.toLowerCase()) ? 1 : 0;
      const bb = b.brand && brands.has(b.brand.toLowerCase()) ? 1 : 0;
      return bb - ba; // los de la marca del súper primero (estable)
    });
  }
  return merged.slice(0, MAX_RESULTS);
}

interface SearchInput {
  query?: string;
  barcode?: string;
  supermercados?: string[];
}

export const searchFood = onCall<SearchInput>(
  { region: 'europe-west1', enforceAppCheck: true },
  async (req) => {
    const data = req.data ?? {};
    const supermercados = Array.isArray(data.supermercados)
      ? data.supermercados.filter((s) => typeof s === 'string').slice(0, 15)
      : [];
    const db = getFirestore();

    // ── Barcode ──
    const barcode = typeof data.barcode === 'string' ? data.barcode.replace(/\D/g, '').slice(0, 20) : '';
    if (barcode) {
      const cached = await getByCode(db, barcode);
      if (cached) return { results: [cached] };
      const off = await productByBarcode(barcode);
      if (!off) return { results: [] };
      await cacheFoods(db, [off]);
      return { results: [offToResult(off)] };
    }

    // ── Nombre ──
    const query = typeof data.query === 'string' ? data.query.trim().slice(0, 60) : '';
    if (query.length < 2) {
      throw new HttpsError('invalid-argument', 'Escribe al menos 2 caracteres o un código de barras.');
    }
    const tokens = tokenize(query);
    const cacheRes = await searchByTokens(db, tokens, MAX_RESULTS);
    // Si el cache ya da resultados de sobra, no tocamos OFF.
    if (cacheRes.length >= 6) {
      return { results: mergeAndBoost(cacheRes, [], supermercados) };
    }
    // Cache-miss / pocos → OFF en vivo (+ cachear).
    const off = await searchOff(query, MAX_RESULTS);
    await cacheFoods(db, off);
    return { results: mergeAndBoost(cacheRes, off.map(offToResult), supermercados) };
  },
);
