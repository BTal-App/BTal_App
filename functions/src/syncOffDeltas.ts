// Función PROGRAMADA · mantiene el cache `foods/` al día con los cambios de
// Open Food Facts (Fase 6B). OFF publica deltas diarios (últimos 14 días) con
// los productos nuevos/modificados. Cada ejecución procesa los ficheros delta
// nuevos desde la última vez (puntero en `_meta/offSync`) y hace UPSERT de los
// productos vendidos en España con los 4 nutrientes completos.
//
// Así la BD se mantiene sola (nuevos productos + reformulaciones) sin tocar la
// API en caliente. Los borrados NO los reportan los deltas → se cubren con un
// re-seed completo ocasional (scripts/import-off-foods.mjs).
//
// `normalizeFoodKey` se comparte con el resolver y el seed (foodCache.ts).

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { Readable } from 'stream';
import readline from 'readline';
import zlib from 'zlib';
import { normalizeFoodKey } from './nutrition/foodCache.js';

const DELTA_INDEX = 'https://static.openfoodfacts.org/data/delta/index.txt';
const DELTA_BASE = 'https://static.openfoodfacts.org/data/delta/';

interface OffProduct {
  product_name?: string;
  countries_tags?: string[];
  nutriments?: Record<string, number | string>;
  brands?: string;
  code?: string;
  last_modified_t?: number;
}

function num(v: number | string | undefined): number | null {
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

interface FoodDoc {
  key: string;
  data: Record<string, unknown>;
}

function toFoodDoc(p: OffProduct): FoodDoc | null {
  const countries = p.countries_tags;
  if (!Array.isArray(countries) || !countries.includes('en:spain')) return null;
  const name = (p.product_name ?? '').trim();
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
  const key = normalizeFoodKey(name);
  if (!key) return null;
  return {
    key,
    data: {
      kcalPer100: Math.round(kcal * 10) / 10,
      protPer100: Math.round(prot * 10) / 10,
      carbPer100: Math.round(carb * 10) / 10,
      fatPer100: Math.round(fat * 10) / 10,
      brand: String(p.brands ?? '').split(',')[0].trim().slice(0, 60),
      source: 'off',
      code: String(p.code ?? '').slice(0, 40),
      lastModified: Number(p.last_modified_t) || 0,
      fetchedAt: Date.now(),
    },
  };
}

async function processDelta(
  db: FirebaseFirestore.Firestore,
  file: string,
): Promise<number> {
  const res = await fetch(DELTA_BASE + file);
  if (!res.ok || !res.body) throw new Error(`fetch ${res.status}`);
  const stream = Readable.fromWeb(
    res.body as Parameters<typeof Readable.fromWeb>[0],
  ).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const col = db.collection('foods');
  let batch = db.batch();
  let inBatch = 0;
  let count = 0;
  for await (const line of rl) {
    if (!line) continue;
    let p: OffProduct;
    try {
      p = JSON.parse(line) as OffProduct;
    } catch {
      continue;
    }
    const doc = toFoodDoc(p);
    if (!doc) continue;
    batch.set(col.doc(doc.key), doc.data, { merge: true });
    inBatch += 1;
    count += 1;
    if (inBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  return count;
}

export const syncOffDeltas = onSchedule(
  {
    schedule: 'every monday 04:00',
    timeZone: 'Europe/Madrid',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore();
    const metaRef = db.doc('_meta/offSync');
    const metaSnap = await metaRef.get();
    const processed: string[] =
      (metaSnap.exists ? (metaSnap.data()?.processed as string[]) : []) ?? [];
    const processedSet = new Set(processed);

    const idxRes = await fetch(DELTA_INDEX);
    if (!idxRes.ok) {
      logger.error('[syncOffDeltas] index falló', { status: idxRes.status });
      return;
    }
    const files = (await idxRes.text())
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const newFiles = files.filter((f) => !processedSet.has(f));
    if (newFiles.length === 0) {
      logger.info('[syncOffDeltas] nada nuevo que procesar');
      return;
    }

    let upserts = 0;
    for (const file of newFiles) {
      try {
        upserts += await processDelta(db, file);
        processedSet.add(file);
      } catch (e) {
        logger.warn('[syncOffDeltas] delta falló', { file, err: String(e) });
      }
    }

    // Guarda el puntero (últimos 60 ficheros · ventana > 14 días de deltas).
    await metaRef.set(
      { processed: [...processedSet].slice(-60), lastRun: Date.now(), lastUpserts: upserts },
      { merge: true },
    );
    logger.info('[syncOffDeltas] OK', { newFiles: newFiles.length, upserts });
  },
);
