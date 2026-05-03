import { doc, getDoc, setDoc, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';

// Toda lectura/escritura a Firestore pasa por aquí.
// Los componentes nunca llaman a Firestore directamente.

export const userDocRef = (uid: string) => doc(db, 'users', uid);

export async function getUserData(uid: string): Promise<DocumentData | null> {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function setUserData(uid: string, data: DocumentData) {
  await setDoc(userDocRef(uid), data, { merge: true });
}
