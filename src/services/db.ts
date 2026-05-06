import type { DocumentData, Firestore } from 'firebase/firestore';
import { app } from './firebase';

// Toda lectura/escritura a Firestore pasa por aquí.
// Los componentes nunca llaman a Firestore directamente.
//
// Firestore se carga bajo demanda: el chunk (~150 KB gz) solo entra en el
// bundle cuando se invoca alguna de estas funciones por primera vez.

let firestorePromise: Promise<typeof import('firebase/firestore')> | null = null;
let firestoreInstance: Firestore | null = null;

async function getDb() {
  const fs = (firestorePromise ??= import('firebase/firestore'));
  const mod = await fs;
  // getFirestore es idempotente para el mismo app, pero cacheamos la instancia
  // para no llamar a la fábrica en cada operación.
  firestoreInstance ??= mod.getFirestore(app);
  return { mod, db: firestoreInstance };
}

export async function getUserData(uid: string): Promise<DocumentData | null> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const snap = await mod.getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setUserData(uid: string, data: DocumentData) {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.setDoc(ref, data, { merge: true });
}
