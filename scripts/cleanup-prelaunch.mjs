// scripts/cleanup-prelaunch.mjs
//
// Script de limpieza PRE-LANZAMIENTO de BTal.
//
// Borra TODOS los users de Firebase Auth + TODOS los documentos de
// la colección /users (incluyendo subcolecciones /registros) en Firestore.
//
// ⚠ IRREVERSIBLE salvo restauración desde backup. Antes de ejecutar:
//    1. Confirma backup reciente en Firebase Console > Firestore > Recuperación
//    2. Lee docs/launch-cleanup.md completo
//    3. Ejecuta primero en pre-prod si tienes (BTal no tiene · esto va directo a prod)
//
// Uso:
//   node scripts/cleanup-prelaunch.mjs
//
// Requisitos:
//   - firebase-admin instalado (npm i -D firebase-admin · NO se commitea como dep)
//   - Service account key en path apuntado por GOOGLE_APPLICATION_CREDENTIALS
//     o tener gcloud auth application-default login activo
//   - Permisos: Firebase Auth Admin + Firestore Editor sobre el proyecto

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const PROJECT_ID = 'btal-app';
const COLLECTION = 'users';
const CONFIRMATION_PHRASE = 'BORRAR TODO';
const AUTH_BATCH_SIZE = 1000; // máximo permitido por deleteUsers()
const FIRESTORE_BATCH_SIZE = 500; // máximo permitido por batch.commit()

// ─── Init ──────────────────────────────────────────────────────────────

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

// ─── Helpers ───────────────────────────────────────────────────────────

function header(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

async function countAuthUsers() {
  let count = 0;
  let nextPageToken;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    count += result.users.length;
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return count;
}

async function countFirestoreUsers() {
  // Solo contamos los docs top-level de /users. Las subcolecciones
  // /registros se borran en cascada con el método recursive más abajo.
  const snap = await db.collection(COLLECTION).count().get();
  return snap.data().count;
}

async function confirmDestructive(rl) {
  console.log(`⚠  Esta operación BORRARÁ:`);
  console.log(`   - Todos los users de Firebase Auth del proyecto ${PROJECT_ID}`);
  console.log(`   - Todos los documentos de /users (con subcolecciones)`);
  console.log(``);
  console.log(`   Es IRREVERSIBLE salvo restauración desde backup.`);
  console.log(``);
  const typed = await rl.question(
    `Tipea exactamente "${CONFIRMATION_PHRASE}" (en mayúsculas) para continuar:\n> `
  );
  return typed === CONFIRMATION_PHRASE;
}

// ─── Firestore cleanup ─────────────────────────────────────────────────

/**
 * Borra recursivamente cada doc /users/{uid} incluyendo sus subcolecciones.
 * Usa el método recursiveDelete del Admin SDK · más eficiente que iterar
 * batches manualmente.
 *
 * Si /users tiene miles de docs, esta operación puede tardar minutos.
 */
async function wipeFirestoreUsers() {
  console.log(`[Firestore] Iniciando borrado recursivo de /${COLLECTION}/...`);
  const bulkWriter = db.bulkWriter();
  await db.recursiveDelete(db.collection(COLLECTION), bulkWriter);
  console.log(`[Firestore] ✓ Colección /${COLLECTION}/ vaciada`);
}

// ─── Auth cleanup ──────────────────────────────────────────────────────

/**
 * Borra TODOS los users de Firebase Auth iterando con listUsers + deleteUsers
 * en batches de 1000 (máximo permitido).
 *
 * Rate limit del Admin SDK: ~1000 ops/min. Si tienes >5K users el script
 * mete sleep entre batches para no llegar al limit.
 */
async function wipeAuthUsers() {
  console.log(`[Auth] Iniciando borrado de users en batches de ${AUTH_BATCH_SIZE}...`);
  let totalDeleted = 0;
  let batchNum = 0;
  while (true) {
    const result = await auth.listUsers(AUTH_BATCH_SIZE);
    if (result.users.length === 0) break;
    batchNum++;
    const uids = result.users.map((u) => u.uid);
    const deleteResult = await auth.deleteUsers(uids);
    totalDeleted += deleteResult.successCount;
    console.log(
      `[Auth] Batch ${batchNum}: ${deleteResult.successCount} borrados`
      + (deleteResult.failureCount > 0
        ? `, ${deleteResult.failureCount} fallidos`
        : '')
    );
    if (deleteResult.failureCount > 0) {
      for (const err of deleteResult.errors) {
        console.warn(`  - uid=${uids[err.index]}: ${err.error.message}`);
      }
    }
    // Sleep 1s entre batches si hay más para procesar · evita rate limit
    if (result.pageToken) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      break;
    }
  }
  console.log(`[Auth] ✓ Total borrados: ${totalDeleted}`);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  header('BTal · cleanup pre-lanzamiento');

  // Estado inicial
  console.log(`Contando users iniciales...`);
  const initialAuth = await countAuthUsers();
  const initialFirestore = await countFirestoreUsers();
  console.log(`  Auth users:     ${initialAuth}`);
  console.log(`  Firestore docs: ${initialFirestore} en /${COLLECTION}/`);

  if (initialAuth === 0 && initialFirestore === 0) {
    console.log(`\n✓ La base de datos ya está vacía. Nada que hacer.`);
    process.exit(0);
  }

  // Confirmación
  const rl = createInterface({ input, output });
  const confirmed = await confirmDestructive(rl);
  rl.close();
  if (!confirmed) {
    console.log(`\n❌ Confirmación incorrecta · abortando.`);
    process.exit(1);
  }

  // Ejecución
  const start = Date.now();
  await wipeFirestoreUsers();
  await wipeAuthUsers();

  // Verificación
  console.log(`\nVerificando estado final...`);
  const finalAuth = await countAuthUsers();
  const finalFirestore = await countFirestoreUsers();
  console.log(`  Auth users:     ${finalAuth}`);
  console.log(`  Firestore docs: ${finalFirestore} en /${COLLECTION}/`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(60)}`);
  if (finalAuth === 0 && finalFirestore === 0) {
    console.log(`✅ Limpieza completada en ${elapsed}s · base de datos vacía y lista para launch`);
  } else {
    console.log(
      `⚠  Limpieza parcial en ${elapsed}s · quedan ${finalAuth} Auth + `
      + `${finalFirestore} Firestore · revisar logs arriba`,
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`\n❌ Error fatal:`, err);
  process.exit(3);
});
