import type { DocumentData } from 'firebase/firestore';
import { app } from './firebase';

// Toda lectura/escritura a Firestore pasa por aquí.
// Los componentes nunca llaman a Firestore directamente.
//
// Firestore se carga bajo demanda: el chunk (~150 KB gz) solo entra en el
// bundle cuando se invoca alguna de estas funciones por primera vez.

let firestorePromise: Promise<typeof import('firebase/firestore')> | null = null;
const loadFirestore = () => (firestorePromise ??= import('firebase/firestore'));

export async function getUserData(uid: string): Promise<DocumentData | null> {
  const fs = await loadFirestore();
  const ref = fs.doc(fs.getFirestore(app), 'users', uid);
  const snap = await fs.getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setUserData(uid: string, data: DocumentData) {
  const fs = await loadFirestore();
  const ref = fs.doc(fs.getFirestore(app), 'users', uid);
  await fs.setDoc(ref, data, { merge: true });
}
