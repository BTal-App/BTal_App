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
//   1. gcloud auth login                          (una sola vez si hace falta)
//   2. node scripts/delete-guests.mjs             (DRY-RUN, no toca nada)
//   3. node scripts/delete-guests.mjs --execute   (borra de verdad)
//
// Idempotente · seguro re-ejecutar.

import { execSync } from 'child_process';

const DRY_RUN = !process.argv.includes('--execute');
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
console.log('Listando docs Firestore /users con expiresAt...');
const docUids = new Set();
let pageToken;
do {
  const params = new URLSearchParams({ pageSize: '300' });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await call(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?${params}`,
  );
  for (const doc of data.documents || []) {
    if (doc.fields?.expiresAt) {
      const uid = doc.name.split('/').pop();
      docUids.add(uid);
    }
  }
  pageToken = data.nextPageToken;
} while (pageToken);
console.log(`  Docs con expiresAt: ${docUids.size}\n`);

// === Diff ===
const onlyAuth = [...anonymousUids].filter((u) => !docUids.has(u));
const onlyDoc = [...docUids].filter((u) => !anonymousUids.has(u));
const inBoth = [...anonymousUids].filter((u) => docUids.has(u));
const toDelete = new Set([...anonymousUids, ...docUids]);

console.log('Resumen:');
console.log(`  En Auth y Firestore (par limpio): ${inBoth.length}`);
console.log(`  Solo en Auth (sin doc):           ${onlyAuth.length}`);
console.log(`  Solo en Firestore (huerfanos):    ${onlyDoc.length}`);
console.log(`  Total UIDs a procesar:            ${toDelete.size}\n`);

if (toDelete.size === 0) {
  console.log('Nada que borrar. Saliendo.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log(
    'DRY-RUN. Para borrar de verdad:  node scripts/delete-guests.mjs --execute\n',
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
