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
// existía (re-onboarding o doc parcial), actualiza profile + lastActive y
// rellena cualquier campo que falte con sus defaults (heals partial docs).
export async function saveOnboardingProfile(
  uid: string,
  profile: UserProfile,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const existing = await mod.getDoc(ref);
  const now = Date.now();
  const completedProfile: UserProfile = { ...profile, completed: true };

  if (existing.exists()) {
    const data = existing.data() as Partial<UserDocument>;
    // Solo añadimos los campos que falten (no sobrescribimos los que ya
    // tenga el doc — preserva preferences, plan_pro real, createdAt).
    const updates: Record<string, unknown> = {
      profile: completedProfile,
      lastActive: now,
    };
    if (data.plan_pro === undefined) updates.plan_pro = false;
    if (data.fecha_expiracion === undefined) updates.fecha_expiracion = null;
    if (data.fecha_ultima_generacion === undefined) updates.fecha_ultima_generacion = null;
    if (data.createdAt === undefined) updates.createdAt = now;
    await mod.updateDoc(ref, updates);
  } else {
    // Primera vez: doc completo con defaults + el profile rellenado.
    const initial: UserDocument = {
      ...defaultUserDocument(),
      profile: completedProfile,
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

// Guarda solo el bloque `preferences`. Usa updateDoc → si el doc no
// existe (usuario aún sin onboarding) lanza 'not-found'; el caller debe
// tragarse ese error (las prefs se quedan en local hasta que onboarding
// cree el doc). Esto evita crear documentos parciales tipo
// `{ preferences: ... }` sin `profile`, que rompían la app después al
// leer userDoc.profile.completed.
export async function setUserPreferences(uid: string, prefs: Preferences): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, { preferences: prefs });
}
