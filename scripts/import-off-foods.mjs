// Seed inicial del cache de alimentos `foods/` en Firestore desde el dump de
// Open Food Facts (Fase 6B · macros reales del menú).
//
// Descarga (o lee local) el CSV gz de OFF, lo STREAMEA línea a línea (no cabe
// en RAM), filtra productos vendidos en España con los 4 nutrientes completos,
// los DEDUPLICA por clave normalizada (la más escaneada gana) y escribe los
// top-N en `foods/{key}` = macros por 100 g. La generación del menú lee de ahí
// (cero llamadas a la API de OFF en caliente · sin rate limit).
//
// La clave normalizada DEBE coincidir EXACTO con functions/src/nutrition/
// foodCache.ts → normalizeFoodKey (replicado abajo). Si divergen, no casan.
//
// Auth: gcloud token + Firestore REST (mismo patrón que delete-guests.mjs ·
// evita los quirks del Admin SDK con quota project en user-ADC).
// Datos: OpenFoodFacts · licencia ODbL · atribución "Datos de OpenFoodFacts".
//
// Uso (Node 18+, gcloud logueado):
//   node scripts/import-off-foods.mjs                 (DRY-RUN · descarga, filtra, cuenta)
//   node scripts/import-off-foods.mjs --execute       (escribe en Firestore)
//   node scripts/import-off-foods.mjs --file ruta.csv.gz   (usa un dump local ya descargado)
//   node scripts/import-off-foods.mjs --limit 30000        (top-N por popularidad · def 25000)

import { execSync } from 'child_process';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import readline from 'readline';
import zlib from 'zlib';

const DRY_RUN = !process.argv.includes('--execute');
const PROJECT_ID = 'btal-app';
const DUMP_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const fileArg = argValue('--file');
const LIMIT = Number(argValue('--limit') ?? 25000);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

// ── normalizeFoodKey · COPIA EXACTA de functions/src/nutrition/foodCache.ts ──
const STRIP_WORDS = new Set([
  'de', 'del', 'con', 'sin', 'y', 'e', 'o', 'a', 'al', 'la', 'el', 'los', 'las',
  'un', 'una', 'unos', 'unas', 'en', 'tipo', 'estilo',
  'plancha', 'horno', 'cocido', 'cocida', 'cocidos', 'cocidas', 'hervido',
  'hervida', 'asado', 'asada', 'asados', 'frito', 'frita', 'salteado',
  'salteada', 'vapor', 'crudo', 'cruda', 'troceado', 'troceada', 'picado',
  'picada', 'rallado', 'rallada', 'rodajas', 'laminado', 'fileteado',
  'fresco', 'fresca', 'natural', 'casero', 'casera', 'ecologico', 'ecologica',
]);
function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normalizeFoodKey(name) {
  if (!name) return '';
  const base = stripAccents(String(name).toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = base
    .split(' ')
    .filter((t) => t && !STRIP_WORDS.has(t) && t.length > 1)
    .sort();
  return tokens.join('_');
}

// Tokens normalizados (NO ordenados, dedup, cap 12) para búsqueda por nombre.
// COPIA EXACTA de functions/src/nutrition/foodCache.ts → tokenize.
function tokenize(name) {
  if (!name) return [];
  const base = stripAccents(String(name).toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out = [];
  const seen = new Set();
  for (const t of base.split(' ')) {
    if (t.length > 1 && !STRIP_WORDS.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= 12) break;
    }
  }
  return out;
}

// ── auth ──
let TOKEN;
try {
  TOKEN = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
} catch {
  console.error('Error obteniendo token gcloud · ¿estás logueado? (gcloud auth login)');
  process.exit(1);
}
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
const DOC_PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents/foods/`;

async function commit(writes) {
  const res = await fetch(COMMIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'x-goog-user-project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    throw new Error(`commit ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}

// ── fuente del dump ──
async function getLineStream() {
  if (fileArg) {
    console.log(`Leyendo dump local: ${fileArg}`);
    return createReadStream(fileArg).pipe(zlib.createGunzip());
  }
  console.log(`Descargando dump OFF (~0,9 GB)…\n  ${DUMP_URL}`);
  const res = await fetch(DUMP_URL);
  if (!res.ok || !res.body) throw new Error(`descarga falló: ${res.status}`);
  return Readable.fromWeb(res.body).pipe(zlib.createGunzip());
}

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

console.log(`\n=== Seed foods/ desde Open Food Facts ${DRY_RUN ? '(DRY-RUN)' : '(EJECUTANDO)'} ===`);
console.log(`Proyecto: ${PROJECT_ID} · top-N: ${LIMIT}\n`);

const stream = await getLineStream();
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

let header = null;
let col = {};
let rows = 0;
let passed = 0;
// best por clave: { key -> {fields, scans} }
const best = new Map();

for await (const line of rl) {
  if (header === null) {
    header = line.split('\t');
    const idx = (name) => header.indexOf(name);
    col = {
      code: idx('code'),
      name: idx('product_name'),
      brands: idx('brands'),
      countries: idx('countries_tags'),
      kcal: idx('energy-kcal_100g'),
      prot: idx('proteins_100g'),
      carb: idx('carbohydrates_100g'),
      fat: idx('fat_100g'),
      scans: idx('unique_scans_n'),
      modified: idx('last_modified_t'),
    };
    continue;
  }
  rows++;
  if (rows % 500000 === 0) console.log(`  …${rows.toLocaleString()} filas, ${passed.toLocaleString()} válidas, ${best.size.toLocaleString()} claves`);

  const f = line.split('\t');
  const countries = f[col.countries] || '';
  if (!countries.includes('en:spain')) continue;

  const name = (f[col.name] || '').trim();
  if (name.length < 2 || name.length > 80) continue;

  const kcal = num(f[col.kcal]);
  const prot = num(f[col.prot]);
  const carb = num(f[col.carb]);
  const fat = num(f[col.fat]);
  if (kcal == null || prot == null || carb == null || fat == null) continue;
  if (kcal <= 0 || kcal > 900 || prot < 0 || prot > 100 || carb < 0 || carb > 100 || fat < 0 || fat > 100) continue;

  const key = normalizeFoodKey(name);
  if (!key) continue;

  passed++;
  const scans = num(f[col.scans]) ?? 0;
  const prev = best.get(key);
  if (prev && prev.scans >= scans) continue;

  best.set(key, {
    scans,
    fields: {
      name: { stringValue: name },
      tokens: { arrayValue: { values: tokenize(name).map((t) => ({ stringValue: t })) } },
      kcalPer100: { doubleValue: Math.round(kcal * 10) / 10 },
      protPer100: { doubleValue: Math.round(prot * 10) / 10 },
      carbPer100: { doubleValue: Math.round(carb * 10) / 10 },
      fatPer100: { doubleValue: Math.round(fat * 10) / 10 },
      brand: { stringValue: (f[col.brands] || '').split(',')[0].trim().slice(0, 60) },
      source: { stringValue: 'off' },
      code: { stringValue: (f[col.code] || '').trim().slice(0, 40) },
      lastModified: { integerValue: String(num(f[col.modified]) ?? 0) },
      fetchedAt: { integerValue: String(Date.now()) },
    },
  });
}

console.log(`\nFilas leídas: ${rows.toLocaleString()}`);
console.log(`Productos ES válidos: ${passed.toLocaleString()}`);
console.log(`Claves únicas: ${best.size.toLocaleString()}`);

// top-N por popularidad
const sorted = [...best.entries()].sort((a, b) => b[1].scans - a[1].scans).slice(0, LIMIT);
console.log(`A escribir (top-${LIMIT}): ${sorted.length.toLocaleString()}\n`);

if (DRY_RUN) {
  console.log('Muestra (10 más populares):');
  for (const [key, v] of sorted.slice(0, 10)) {
    console.log(`  ${key.padEnd(28)} ${v.fields.kcalPer100.doubleValue} kcal/100g · scans ${v.scans}`);
  }
  console.log('\nDRY-RUN. Para escribir:  node scripts/import-off-foods.mjs --execute\n');
  process.exit(0);
}

// commit en lotes de 450
let written = 0;
let batch = [];
async function flush() {
  if (batch.length === 0) return;
  await commit(batch);
  written += batch.length;
  console.log(`  escritos ${written.toLocaleString()}/${sorted.length.toLocaleString()}`);
  batch = [];
}
for (const [key, v] of sorted) {
  batch.push({ update: { name: DOC_PREFIX + key, fields: v.fields } });
  if (batch.length >= 450) await flush();
}
await flush();

console.log(`\n=== Hecho · ${written.toLocaleString()} alimentos en foods/ ===\n`);
