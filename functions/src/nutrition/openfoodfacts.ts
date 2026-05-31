// Cliente OFF EN VIVO (Fase 6B-B · buscador/barcode). Solo se llama en
// cache-miss desde searchFood (la mayoría de búsquedas las resuelve el cache
// `foods/`). 1 llamada por acción del user → el límite 10/min de OFF no molesta.
// User-Agent identificable obligatorio. Datos OFF · licencia ODbL.

import { logger } from 'firebase-functions/v2';

const UA = 'BTal/1.0 (btalapp@gmail.com)';
const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'product_name,product_name_es,brands,code,nutriments';

export interface OffFood {
  name: string;
  brand?: string;
  code?: string;
  kcalPer100: number;
  protPer100: number;
  carbPer100: number;
  fatPer100: number;
}

interface OffProductRaw {
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  code?: string;
  nutriments?: Record<string, number | string>;
}

function num(v: number | string | undefined): number | null {
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

function toOffFood(p: OffProductRaw): OffFood | null {
  const name = (p.product_name_es || p.product_name || '').trim();
  if (name.length < 2 || name.length > 80) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']);
  const prot = num(n.proteins_100g);
  const carb = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (kcal == null || prot == null || carb == null || fat == null) return null;
  if (kcal <= 0 || kcal > 900 || prot < 0 || prot > 100 || carb < 0 || carb > 100 || fat < 0 || fat > 100) {
    return null;
  }
  return {
    name,
    brand: String(p.brands ?? '').split(',')[0].trim().slice(0, 60) || undefined,
    code: String(p.code ?? '').slice(0, 40) || undefined,
    kcalPer100: Math.round(kcal * 10) / 10,
    protPer100: Math.round(prot * 10) / 10,
    carbPer100: Math.round(carb * 10) / 10,
    fatPer100: Math.round(fat * 10) / 10,
  };
}

// Búsqueda por nombre (cgi/search.pl) · prioriza España y populares.
export async function searchOff(query: string, limit: number): Promise<OffFood[]> {
  const url =
    `${SEARCH_URL}?search_terms=${encodeURIComponent(query)}&json=1&page_size=${limit}` +
    `&fields=${FIELDS}&lc=es&countries_tags_en=spain&sort_by=unique_scans_n`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProductRaw[] };
    const out: OffFood[] = [];
    for (const p of data.products ?? []) {
      const f = toOffFood(p);
      if (f) out.push(f);
    }
    return out;
  } catch (e) {
    logger.warn('[searchOff] fallo', { err: String(e) });
    return [];
  }
}

// Producto por código de barras (api/v2/product/{ean}).
export async function productByBarcode(ean: string): Promise<OffFood | null> {
  const url = `${PRODUCT_URL}${encodeURIComponent(ean)}.json?fields=${FIELDS}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: OffProductRaw };
    if (!data.product) return null;
    return toOffFood({ ...data.product, code: data.product.code ?? ean });
  } catch (e) {
    logger.warn('[productByBarcode] fallo', { err: String(e) });
    return null;
  }
}
