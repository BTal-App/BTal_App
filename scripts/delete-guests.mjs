// Cleanup one-shot de invitados anonymous + sus docs Firestore.
//
// Borra:
//   - Usuarios Firebase Auth cuyo provider sea "anonymous" (sin email)
//   - Docs Firestore /users/{uid} con campo `expiresAt` presente
//   - Subcoleccion /users/{uid}/registros entera
//
// Usa REST directo + gcloud token. Evita los quirks del Firebase Admin
// SDK con quota project en user-credentials ADC (el SDK envia un
// consumer wrong, la API rechaza con SERVICE_DISABLED).
//
// Uso (Cloud Shell o local con gcloud + Node 18+):
//   1. gcloud auth login                                       (una sola vez)
//   2. node scripts/delete-guests.mjs                          (DRY-RUN)
//   3. node scripts/delete-guests.mjs --execute                (borra anonymous)
//   4. node scripts/delete-guests.mjs --include-orphans        (DRY-RUN + orphans)
//   5. node scripts/delete-guests.mjs --include-orphans --execute
//
// --include-orphans tambien borra docs Firestore que no tienen Auth user
// asociado (residuos de cuentas borradas manualmente desde Console que
// dejaron el doc colgado).
//
// Idempotente · seguro re-ejecutar.

import { execSync } from 'child_process';

const DRY_RUN = !process.argv.includes('--execute');
const INCLUDE_ORPHANS = process.argv.includes('--include-orphans');
const PROJECT_ID = 'btal-app';

const banner = DRY_RUN
  ? '(DRY-RUN · no borra nada)'
  : '(EJECUCION REAL · borrando!)';
console.log(`\n=== Cleanup invitados ${banner} ===`);
console.log(`Proyecto: ${PROJECT_ID}\n`);

function getToken() {
  return execSync('gcloud auth print-access-token', {
    encoding: 'utf-8',
  }).trim();
}

let TOKEN;
try {
  TOKEN = getToken();
} catch (err) {
  console.error('Error obteniendo token gcloud · ¿estas logueado?');
  console.error(`  gcloud auth login`);
  process.exit(1);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'x-goog-user-project': PROJECT_ID,
    'Content-Type': 'application/json',
  };
}

async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

// === Step 1: list anonymous users in Firebase Auth ===
console.log('Listando usuarios Auth...');
const anonymousUids = new Set();
let totalAuth = 0;
let nextPageToken;
do {
  const params = new URLSearchParams({ maxResults: '1000' });
  if (nextPageToken) params.set('nextPageToken', nextPageToken);
  const data = await call(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?${params}`,
  );
  for (const u of data.users || []) {
    totalAuth++;
    const hasProvider = (u.providerUserInfo || []).length > 0;
    const hasEmail = !!u.email;
    // Anonymous = sin email y sin providers vinculados (google, password, etc)
    if (!hasProvider && !hasEmail) anonymousUids.add(u.localId);
  }
  nextPageToken = data.nextPageToken;
} while (nextPageToken);
console.log(`  Total usuarios Auth: ${totalAuth}`);
console.log(`  Anonymous: ${anonymousUids.size}\n`);

// === Step 2: list Firestore /users docs ===
console.log('Listando docs Firestore /users...');
const docUidsWithExpiresAt = new Set();
const allDocUids = new Set();
let pageToken;
do {
  const params = new URLSearchParams({ pageSize: '300' });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await call(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?${params}`,
  );
  for (const doc of data.documents || []) {
    const uid = doc.name.split('/').pop();
    allDocUids.add(uid);
    if (doc.fields?.expiresAt) docUidsWithExpiresAt.add(uid);
  }
  pageToken = data.nextPageToken;
} while (pageToken);
console.log(`  Total docs /users:    ${allDocUids.size}`);
console.log(`  Docs con expiresAt:   ${docUidsWithExpiresAt.size}\n`);

// === Step 2b: detectar huerfanos (docs sin Auth user) ===
// Necesitamos el set de TODOS los UIDs Auth para detectar huerfanos · no
// solo los anonymous. Lo construimos a partir de docs que NO esten en
// anonymousUids · es mas eficiente listar todo Auth de nuevo? No, mejor
// listar Auth con TODOS los UIDs (no solo anonymous).
//
// Workaround: hacemos un segundo pase sobre Auth para llenar allAuthUids
// si vamos a procesar orphans (modo --include-orphans). En el flujo
// normal anonymous-only no hace falta.
const allAuthUids = new Set();
if (INCLUDE_ORPHANS) {
  let pt2;
  do {
    const params = new URLSearchParams({ maxResults: '1000' });
    if (pt2) params.set('nextPageToken', pt2);
    const data = await call(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?${params}`,
    );
    for (const u of data.users || []) allAuthUids.add(u.localId);
    pt2 = data.nextPageToken;
  } while (pt2);
}

const orphanDocUids = INCLUDE_ORPHANS
  ? new Set([...allDocUids].filter((u) => !allAuthUids.has(u)))
  : new Set();
if (INCLUDE_ORPHANS) {
  console.log(`  Huerfanos detectados (doc sin Auth): ${orphanDocUids.size}\n`);
}

// === Diff ===
const onlyAuth = [...anonymousUids].filter((u) => !docUidsWithExpiresAt.has(u));
const onlyDoc = [...docUidsWithExpiresAt].filter((u) => !anonymousUids.has(u));
const inBoth = [...anonymousUids].filter((u) => docUidsWithExpiresAt.has(u));
const toDelete = new Set([
  ...anonymousUids,
  ...docUidsWithExpiresAt,
  ...orphanDocUids,
]);

console.log('Resumen:');
console.log(`  En Auth y Firestore (par limpio): ${inBoth.length}`);
console.log(`  Solo en Auth (sin doc):           ${onlyAuth.length}`);
console.log(`  Solo en Firestore (con expiresAt, sin Auth): ${onlyDoc.length}`);
if (INCLUDE_ORPHANS) {
  console.log(`  Huerfanos (sin expiresAt, sin Auth): ${orphanDocUids.size}`);
}
console.log(`  Total UIDs a procesar:            ${toDelete.size}\n`);

if (toDelete.size === 0) {
  console.log('Nada que borrar. Saliendo.');
  process.exit(0);
}

if (DRY_RUN) {
  const flag = INCLUDE_ORPHANS ? ' --include-orphans' : '';
  console.log(
    `DRY-RUN. Para borrar de verdad:  node scripts/delete-guests.mjs${flag} --execute\n`,
  );
  process.exit(0);
}

// === Step 3: delete each UID ===
console.log('Borrando... (Ctrl+C para abortar)\n');
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

let firestoreOk = 0;
let firestoreSkip = 0;
let firestoreErr = 0;
let authOk = 0;
let authNotFound = 0;
let authErr = 0;
let registrosDeleted = 0;

let n = 0;
for (const uid of toDelete) {
  // 3a. delete /users/{uid}/registros/* (subcollection)
  try {
    let regToken;
    do {
      const params = new URLSearchParams({ pageSize: '300' });
      if (regToken) params.set('pageToken', regToken);
      const data = await call(`${FS_BASE}/users/${uid}/registros?${params}`);
      for (const regDoc of data.documents || []) {
        try {
          await call(`https://firestore.googleapis.com/v1/${regDoc.name}`, {
            method: 'DELETE',
          });
          registrosDeleted++;
        } catch (err) {
          if (err.status !== 404) {
            console.warn(`  [WARN] registro ${regDoc.name}: ${err.message}`);
          }
        }
      }
      regToken = data.nextPageToken;
    } while (regToken);
  } catch (err) {
    // 404 = no subcollection, OK
    if (err.status !== 404 && !err.body?.includes('NOT_FOUND')) {
      console.warn(`  [WARN] listar registros ${uid}: ${err.message}`);
    }
  }

  // 3b. delete /users/{uid}
  try {
    await call(`${FS_BASE}/users/${uid}`, { method: 'DELETE' });
    firestoreOk++;
  } catch (err) {
    if (err.status === 404) firestoreSkip++;
    else {
      firestoreErr++;
      console.warn(`  [WARN] Firestore ${uid}: ${err.message}`);
    }
  }

  // 3c. delete Auth user
  try {
    await call(`${AUTH_BASE}/accounts:delete`, {
      method: 'POST',
      body: JSON.stringify({ localId: uid }),
    });
    authOk++;
  } catch (err) {
    if (err.body?.includes('USER_NOT_FOUND') || err.status === 400) {
      authNotFound++;
    } else {
      authErr++;
      console.warn(`  [WARN] Auth ${uid}: ${err.message}`);
    }
  }

  n++;
  if (n % 25 === 0) console.log(`  Progreso: ${n}/${toDelete.size}`);
}

console.log(`\n=== Resultado ===`);
console.log(`  Firestore docs borrados:   ${firestoreOk}`);
console.log(`  Firestore docs ya no existian: ${firestoreSkip}`);
console.log(`  Firestore errores:         ${firestoreErr}`);
console.log(`  Registros borrados:        ${registrosDeleted}`);
console.log(`  Auth users borrados:       ${authOk}`);
console.log(`  Auth users ya no existian: ${authNotFound}`);
console.log(`  Auth errores:              ${authErr}`);
console.log(`\n${n}/${toDelete.size} UIDs procesados.\n`);
