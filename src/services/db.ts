import type { Firestore } from 'firebase/firestore';
import { app } from './firebase';
import {
  defaultCompra,
  defaultEntrenos,
  defaultGeneraciones,
  defaultMenu,
  defaultPlan,
  defaultSuplementos,
  defaultUserDocument,
  type UserDocument,
  type UserProfile,
} from '../templates/defaultUser';
import { demoUserDocument } from '../templates/demoUser';
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
    // tenga el doc — preserva preferences, plan_pro real, createdAt, y
    // muy importante: el menu/entrenos/compra/suplementos que el user ya
    // pueda haber rellenado, ya sea manual o por una generación anterior).
    const updates: Record<string, unknown> = {
      profile: completedProfile,
      lastActive: now,
    };
    if (data.plan_pro === undefined) updates.plan_pro = false;
    if (data.fecha_expiracion === undefined) updates.fecha_expiracion = null;
    if (data.fecha_ultima_generacion === undefined) updates.fecha_ultima_generacion = null;
    if (data.createdAt === undefined) updates.createdAt = now;
    // Aviso médico: solo lo escribimos si aún no estaba — evita pisar
    // una aceptación previa más antigua si el user re-completa onboarding.
    if (data.medicalDisclaimerAcceptedAt === undefined || data.medicalDisclaimerAcceptedAt === null) {
      updates.medicalDisclaimerAcceptedAt = now;
    }
    // Estructura de la app (Fase 2A) · solo se siembra si falta para no
    // pisar datos del usuario. Cubre el caso de cuentas viejas creadas
    // antes de Fase 2A que no tenían estos campos en su schema.
    if (data.menu === undefined) updates.menu = defaultMenu();
    if (data.entrenos === undefined) updates.entrenos = defaultEntrenos();
    if (data.compra === undefined) updates.compra = defaultCompra();
    if (data.suplementos === undefined) updates.suplementos = defaultSuplementos();
    // Plan + generaciones granulares (Fase 2A · prep IA Fase 6).
    if (data.plan === undefined) updates.plan = defaultPlan();
    if (data.generaciones === undefined) updates.generaciones = defaultGeneraciones();
    await mod.updateDoc(ref, updates);
  } else {
    // Primera vez: doc completo con defaults + el profile rellenado.
    // El disclaimer se da por aceptado en este momento (el usuario solo
    // llega aquí desde el paso 1 del onboarding tras marcar el checkbox).
    // `defaultUserDocument()` ya incluye menu/entrenos/compra/suplementos
    // vacíos — punto de partida idéntico para modos IA y manual.
    const initial: UserDocument = {
      ...defaultUserDocument(),
      profile: completedProfile,
      medicalDisclaimerAcceptedAt: now,
    };
    await mod.setDoc(ref, initial);
  }
}

// Migra un documento de usuario al schema actual añadiendo cualquier campo
// que falte (sin pisar lo que ya está). Se llama tras leer el doc en
// ProfileProvider para que cuentas creadas con schemas antiguos sigan
// funcionando con la app nueva. Devuelve el doc resultante con todos los
// campos garantizados — los consumidores (HoyPage, MenuPage, etc.) pueden
// asumir que `userDoc.menu`, `userDoc.entrenos`, etc. nunca son undefined.
export async function ensureUserDocumentSchema(
  uid: string,
  doc: UserDocument,
): Promise<UserDocument> {
  const updates: Record<string, unknown> = {};
  // Cast a Partial<UserDocument> dentro de la comprobación porque el tipo
  // de `doc` ya promete los campos — pero en runtime un doc viejo puede
  // tenerlos undefined. La verificación es la realidad, no el tipo.
  const raw = doc as Partial<UserDocument>;
  if (raw.menu === undefined) updates.menu = defaultMenu();
  if (raw.entrenos === undefined) updates.entrenos = defaultEntrenos();
  if (raw.compra === undefined) updates.compra = defaultCompra();
  if (raw.suplementos === undefined) updates.suplementos = defaultSuplementos();
  // Plan granular + generaciones (Fase 2A) · si faltan los sembramos
  // con free/zero. La Cloud Function `generatePlan` los actualizará
  // cuando llegue Fase 6 con la primera generación real.
  if (raw.plan === undefined) updates.plan = defaultPlan();
  if (raw.generaciones === undefined) updates.generaciones = defaultGeneraciones();
  if (raw.plan_pro === undefined) updates.plan_pro = false;
  if (raw.fecha_expiracion === undefined) updates.fecha_expiracion = null;
  if (raw.fecha_ultima_generacion === undefined) updates.fecha_ultima_generacion = null;
  if (raw.medicalDisclaimerAcceptedAt === undefined) updates.medicalDisclaimerAcceptedAt = null;

  if (Object.keys(updates).length === 0) return doc;

  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, updates);
  // Devolvemos el doc combinado · sin re-leer Firestore (innecesario y caro).
  return { ...doc, ...updates } as UserDocument;
}

// Siembra el documento de un usuario invitado (sesión anónima) con el
// `demoUser` completo. Idempotente: si el doc ya existe (porque el invitado
// ya entró en una sesión anterior y editó algo), no lo pisa.
//
// Lo llama Landing.tsx justo después de signInAnonymously. La razón de
// que esté aquí y no en Landing es que el modelo de datos vive en este
// servicio — Landing solo orquesta el flujo, no decide qué se siembra.
export async function seedGuestDocument(uid: string): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const existing = await mod.getDoc(ref);
  if (existing.exists()) {
    // El invitado ya tiene doc — no lo pisamos. Solo refrescamos lastActive.
    await mod.setDoc(ref, { lastActive: Date.now() }, { merge: true });
    return;
  }
  await mod.setDoc(ref, demoUserDocument());
}

// Actualiza solo el campo `profile.modo` (paso usado por Settings →
// "Cambiar modo de generación"). No toca el resto del doc — el menú/
// entrenos/compra que el user ya tenga siguen intactos.
export async function updateUserMode(
  uid: string,
  modo: UserProfile['modo'],
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    'profile.modo': modo,
    lastActive: Date.now(),
  });
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

// Actualiza solo algunos campos dentro de `profile` (peso, altura, objetivo,
// etc.). Usado desde Settings → "Editar datos del perfil". No tocamos
// `completed` desde aquí: ese flag solo lo pone saveOnboardingProfile.
// Usamos paths con punto (`profile.peso`) para que Firestore haga merge a
// nivel de campo individual y no sobrescriba el resto del bloque profile.
export async function updateUserProfileFields(
  uid: string,
  partial: Partial<UserProfile>,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  for (const [key, value] of Object.entries(partial)) {
    // Salvaguarda: nunca permitimos "descompletar" el perfil ni cambiar
    // el modo de generación desde este helper (ese flujo va por otra ruta).
    if (key === 'completed') continue;
    updates[`profile.${key}`] = value;
  }
  await mod.updateDoc(ref, updates);
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
