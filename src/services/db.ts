import type { Firestore } from 'firebase/firestore';
import { app } from './firebase';
import {
  DAY_KEYS,
  HORA_DEFECTO,
  MEAL_KEYS,
  defaultCompra,
  defaultEntrenos,
  defaultGeneraciones,
  defaultMenu,
  defaultPlan,
  defaultSuplementos,
  defaultUserDocument,
  type Comida,
  type Compra,
  type DiaEntreno,
  type Ejercicio,
  type Entrenos,
  type ItemCompra,
  type Menu,
  type MealKey,
  type SourceTag,
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

  // ── Migración campos del profile (Fase 2A.1) ──
  // Estos campos los introdujimos al añadir el paso 4 del onboarding
  // (notas + intolerancias + alergias + alimentos prohibidos / obligatorios
  // / favoritos). Para docs creados antes de Fase 2A.1, los rellenamos con
  // valores vacíos · el user puede editarlos después en Settings.
  const profile = raw.profile as Partial<UserProfile> | undefined;
  if (profile) {
    const profileUpdates: Record<string, unknown> = {};
    if (profile.notas === undefined) profileUpdates['profile.notas'] = '';
    if (profile.intolerancias === undefined) profileUpdates['profile.intolerancias'] = [];
    if (profile.alergias === undefined) profileUpdates['profile.alergias'] = [];
    if (profile.alimentosProhibidos === undefined) profileUpdates['profile.alimentosProhibidos'] = [];
    if (profile.alimentosObligatorios === undefined) profileUpdates['profile.alimentosObligatorios'] = [];
    if (profile.ingredientesFavoritos === undefined) profileUpdates['profile.ingredientesFavoritos'] = [];
    Object.assign(updates, profileUpdates);
  }

  // ── Migración del flag `source` en items (Fase 2A.1) ──
  // Los items legacy (Comida/Ejercicio/ItemCompra/DiaEntreno) no tenían
  // `source`. Ahora la lógica "la IA no toca lo del user" lo necesita.
  // Sample-based: comprobamos un item; si le falta source, regeneramos
  // ese bloque entero marcando todos los items como 'default'. Esto NO
  // pisa los items que ya tengan source ni los datos del user.
  const menu = (raw.menu ?? updates.menu) as Menu | undefined;
  if (menu && menuNeedsSourceMigration(menu)) {
    updates.menu = withDefaultSourceInMenu(menu);
  }
  const entrenos = (raw.entrenos ?? updates.entrenos) as Entrenos | undefined;
  if (entrenos && entrenosNeedsSourceMigration(entrenos)) {
    updates.entrenos = withDefaultSourceInEntrenos(entrenos);
  }
  const compra = (raw.compra ?? updates.compra) as Compra | undefined;
  if (compra && compraNeedsSourceMigration(compra)) {
    updates.compra = withDefaultSourceInCompra(compra);
  }

  if (Object.keys(updates).length === 0) return doc;

  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, updates);
  // Devolvemos el doc combinado · sin re-leer Firestore (innecesario y caro).
  return { ...doc, ...updates } as UserDocument;
}

// ── Helpers de migración del flag `source` ──
// Sample-based: solo regeneramos un bloque (menu/entrenos/compra) si
// detectamos que algún item le falta source. Si todos lo tienen, no
// tocamos. La función es idempotente — llamada repetida no hace nada.

const ensureSource = <T extends Partial<{ source: SourceTag }>>(
  item: T,
): T & { source: SourceTag } => ({ ...item, source: item.source ?? 'default' });

function menuNeedsSourceMigration(menu: Menu): boolean {
  for (const day of DAY_KEYS) {
    for (const meal of MEAL_KEYS) {
      const c = menu[day]?.[meal] as Partial<Comida> | undefined;
      if (c && c.source === undefined) return true;
    }
  }
  return false;
}

function withDefaultSourceInMenu(menu: Menu): Menu {
  const out = {} as Menu;
  for (const day of DAY_KEYS) {
    const dayMenu = menu[day] as Partial<Menu[typeof day]> | undefined;
    out[day] = {
      desayuno: dayMenu?.desayuno ? ensureSource(dayMenu.desayuno) : emptyMigrationComida('desayuno'),
      comida: dayMenu?.comida ? ensureSource(dayMenu.comida) : emptyMigrationComida('comida'),
      merienda: dayMenu?.merienda ? ensureSource(dayMenu.merienda) : emptyMigrationComida('merienda'),
      cena: dayMenu?.cena ? ensureSource(dayMenu.cena) : emptyMigrationComida('cena'),
    };
  }
  return out;
}

// Comida vacía generada durante la migración cuando un día/comida no existe
// en el doc viejo. No exportamos `emptyComida` desde defaultUser porque es
// implementación interna de su factory · aquí lo replicamos a propósito.
function emptyMigrationComida(meal: MealKey): Comida {
  return {
    alimentos: [],
    hora: HORA_DEFECTO[meal],
    kcal: 0,
    prot: 0,
    carb: 0,
    fat: 0,
    source: 'default',
  };
}

function entrenosNeedsSourceMigration(entrenos: Entrenos): boolean {
  for (const planNum of [1, 2, 3, 4, 5, 6, 7] as const) {
    const plan = entrenos.planes?.[planNum];
    if (!plan || !Array.isArray(plan.dias)) continue;
    for (const dia of plan.dias) {
      const d = dia as Partial<DiaEntreno>;
      if (d.source === undefined) return true;
      if (!Array.isArray(dia.ejercicios)) continue;
      for (const ej of dia.ejercicios) {
        if ((ej as Partial<Ejercicio>).source === undefined) return true;
      }
    }
  }
  return false;
}

function withDefaultSourceInEntrenos(entrenos: Entrenos): Entrenos {
  const out: Entrenos = {
    ...entrenos,
    planes: { ...entrenos.planes },
  };
  for (const planNum of [1, 2, 3, 4, 5, 6, 7] as const) {
    const plan = out.planes[planNum];
    if (!plan) continue;
    const dias = Array.isArray(plan.dias) ? plan.dias : [];
    out.planes[planNum] = {
      ...plan,
      dias: dias.map((d) => ({
        ...ensureSource(d),
        ejercicios: Array.isArray(d.ejercicios)
          ? d.ejercicios.map((ej) => ensureSource(ej))
          : [],
      })),
    };
  }
  return out;
}

function compraNeedsSourceMigration(compra: Compra): boolean {
  for (const cat of Object.keys(compra) as (keyof Compra)[]) {
    const items = compra[cat];
    // Defensivo: docs corruptos podrían tener un valor que no sea array.
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if ((item as Partial<ItemCompra>).source === undefined) return true;
    }
  }
  return false;
}

function withDefaultSourceInCompra(compra: Compra): Compra {
  const out = {} as Compra;
  for (const cat of Object.keys(compra) as (keyof Compra)[]) {
    const items = compra[cat];
    out[cat] = Array.isArray(items) ? items.map((item) => ensureSource(item)) : [];
  }
  return out;
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
