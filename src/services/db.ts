import type { Firestore } from 'firebase/firestore';
import { app } from './firebase';
import {
  defaultUserDocument,
  type UserDocument,
  type UserProfile,
} from '../templates/defaultUser';
import type { Preferences } from '../utils/units';

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

// ────────────────────────────────────────────────────────────────────────────
// User document (/users/{uid})

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const snap = await mod.getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

// Guarda el perfil completo al terminar el onboarding. Si el documento no
// existía, lo crea con los defaults (plan_pro=false, createdAt, etc.); si ya
// existía (re-onboarding), solo actualiza el bloque `profile` y `lastActive`.
export async function saveOnboardingProfile(
  uid: string,
  profile: UserProfile,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const existing = await mod.getDoc(ref);
  const now = Date.now();

  if (existing.exists()) {
    // Re-ejecutar onboarding: actualizamos solo profile + lastActive,
    // preservamos plan_pro / fechas / createdAt.
    await mod.updateDoc(ref, {
      profile: { ...profile, completed: true },
      lastActive: now,
    });
  } else {
    // Primera vez: doc completo con defaults + el profile rellenado.
    const initial: UserDocument = {
      ...defaultUserDocument(),
      profile: { ...profile, completed: true },
    };
    await mod.setDoc(ref, initial);
  }
}

// Actualiza solo `lastActive` (cada vez que el user abre el dashboard).
// No-op si el doc todavía no existe — el onboarding lo creará.
export async function touchLastActive(uid: string): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  // updateDoc falla si el doc no existe; con setDoc + merge nunca crea
  // claves nuevas accidentalmente.
  await mod.setDoc(ref, { lastActive: Date.now() }, { merge: true });
}

// Guarda solo el bloque `preferences` (sin tocar profile, plan_pro, etc.).
// Crea el doc si no existe (merge:true) — útil para usuarios reales que
// aún no han pasado por onboarding.
export async function setUserPreferences(uid: string, prefs: Preferences): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.setDoc(ref, { preferences: prefs }, { merge: true });
}
