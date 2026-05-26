// Cleanup one-shot de invitados anonymous + sus docs Firestore.
//
// Borra:
//   - Usuarios Firebase Auth cuyo provider sea "anonymous" (sin email)
//   - Docs Firestore /users/{uid} con campo `expiresAt` presente
//   - Subcoleccion /users/{uid}/registros (recursive)
//
// Uso:
//   1. gcloud auth application-default login          (una sola vez)
//   2. cd btal && npm install --save-dev firebase-admin   (una sola vez)
//   3. node scripts/delete-guests.mjs                  (DRY-RUN, no toca nada)
//   4. node scripts/delete-guests.mjs --execute        (borra de verdad)
//
// Idempotente · seguro re-ejecutar. No toca cuentas reales (con email).

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = !process.argv.includes('--execute');
const PROJECT_ID = 'btal-app';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

const banner = DRY_RUN
  ? '(DRY-RUN · no borra nada)'
  : '(EJECUCION REAL · borrando!)';
console.log(`\n=== Cleanup invitados ${banner} ===`);
console.log(`Proyecto: ${PROJECT_ID}\n`);

// === Paso 1: enumerar usuarios anonymous en Auth ===
console.log('Listando usuarios Auth...');
let totalAuth = 0;
const anonymousUids = new Set();
let nextPageToken;
do {
  const res = await auth.listUsers(1000, nextPageToken);
  for (const u of res.users) {
    totalAuth++;
    // Anonymous = sin providerData (sin email, sin google, etc)
    if (!u.providerData || u.providerData.length === 0) {
      anonymousUids.add(u.uid);
    }
  }
  nextPageToken = res.pageToken;
} while (nextPageToken);
console.log(`  Total usuarios Auth: ${totalAuth}`);
console.log(`  Anonymous: ${anonymousUids.size}\n`);

// === Paso 2: enumerar docs Firestore /users con expiresAt ===
console.log('Listando docs Firestore /users con expiresAt...');
// orderBy('expiresAt') solo devuelve docs donde el campo exista, asi que
// equivale a "donde expiresAt esta definido".
const docsSnap = await db.collection('users').orderBy('expiresAt').get();
const docUids = new Set(docsSnap.docs.map((d) => d.id));
console.log(`  Docs con expiresAt: ${docUids.size}\n`);

// === Diff ===
const onlyAuth = [...anonymousUids].filter((u) => !docUids.has(u));
const onlyDoc = [...docUids].filter((u) => !anonymousUids.has(u));
const inBoth = [...anonymousUids].filter((u) => docUids.has(u));
const toDelete = new Set([...anonymousUids, ...docUids]);

console.log(`Resumen:`);
console.log(`  En Auth y Firestore (par limpio): ${inBoth.length}`);
console.log(`  Solo en Auth (sin doc):           ${onlyAuth.length}`);
console.log(`  Solo en Firestore (huerfanos):    ${onlyDoc.length}`);
console.log(`  Total UIDs a procesar:            ${toDelete.size}\n`);

if (toDelete.size === 0) {
  console.log('Nada que borrar. Saliendo.');
  process.exit(0);
}

// === Paso 3: borrar (si --execute) ===
if (DRY_RUN) {
  console.log(
    'DRY-RUN. Para borrar de verdad:  node scripts/delete-guests.mjs --execute\n',
  );
  process.exit(0);
}

console.log('Borrando... (Ctrl+C para abortar)\n');
let n = 0;
let firestoreOk = 0;
let firestoreErr = 0;
let authOk = 0;
let authErr = 0;
let authNotFound = 0;
for (const uid of toDelete) {
  // Borrar /users/{uid} + subcolecciones (recursive)
  try {
    await db.recursiveDelete(db.collection('users').doc(uid));
    firestoreOk++;
  } catch (err) {
    firestoreErr++;
    console.warn(`  [WARN] Firestore ${uid}: ${err.message}`);
  }
  // Borrar Auth user (puede no existir)
  try {
    await auth.deleteUser(uid);
    authOk++;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
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
console.log(`  Firestore borrados:    ${firestoreOk}`);
console.log(`  Firestore errores:     ${firestoreErr}`);
console.log(`  Auth borrados:         ${authOk}`);
console.log(`  Auth ya no existian:   ${authNotFound}`);
console.log(`  Auth errores:          ${authErr}`);
console.log(`\n${n}/${toDelete.size} UIDs procesados.\n`);
