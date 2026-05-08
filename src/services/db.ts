import type { Firestore } from 'firebase/firestore';
import { app } from './firebase';
import {
  DAY_KEYS,
  HORA_DEFECTO,
  MEAL_KEYS,
  defaultBatidoConfig,
  defaultCompra,
  defaultCreatinaConfig,
  defaultEntrenos,
  defaultGeneraciones,
  defaultMenu,
  defaultPlan,
  defaultSuplementos,
  defaultUserDocument,
  parseAlimentoString,
  type Alimento,
  type BatidoConfig,
  type Comida,
  type ComidaExtra,
  type ComidasDelDia,
  type Compra,
  type CreatinaConfig,
  type DayKey,
  type DiaEntreno,
  type Ejercicio,
  type Entrenos,
  type ItemCompra,
  type Menu,
  type MealKey,
  type SourceTag,
  type SupDayOverride,
  type Suplementos,
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
  if (raw.suplementos === undefined) {
    updates.suplementos = defaultSuplementos();
  } else {
    // Migración granular de los campos nuevos de Suplementos (Sub-fase
    // 2B.5.a) · docs creados antes de batido/creatina configurables tienen
    // suplementos = { batidos_restantes, creatina_dosis_restantes } y les
    // faltan los nuevos campos. Los rellenamos con defaults sin tocar los
    // contadores existentes. Usamos paths con punto para hacer merge a
    // nivel de campo (no sobrescribimos el bloque entero).
    const sup = raw.suplementos as Partial<Suplementos>;
    if (sup.batidoConfig === undefined) {
      updates['suplementos.batidoConfig'] = defaultBatidoConfig();
    } else {
      // Sub-fase 2B.5.b · campos de producto (nombre + precio).
      const bc = sup.batidoConfig as Partial<BatidoConfig>;
      if (bc.producto_nombre === undefined) {
        updates['suplementos.batidoConfig.producto_nombre'] = '';
      }
      if (bc.producto_precio === undefined) {
        updates['suplementos.batidoConfig.producto_precio'] = null;
      }
    }
    if (sup.creatinaConfig === undefined) {
      updates['suplementos.creatinaConfig'] = defaultCreatinaConfig();
    } else {
      const cc = sup.creatinaConfig as Partial<CreatinaConfig>;
      if (cc.producto_nombre === undefined) {
        updates['suplementos.creatinaConfig.producto_nombre'] = '';
      }
      if (cc.producto_precio === undefined) {
        updates['suplementos.creatinaConfig.producto_precio'] = null;
      }
    }
    if (sup.daysWithBatido === undefined) {
      updates['suplementos.daysWithBatido'] = [];
    }
    if (sup.daysWithCreatina === undefined) {
      updates['suplementos.daysWithCreatina'] = [];
    }
    if (sup.batidoOverrides === undefined) {
      updates['suplementos.batidoOverrides'] = {};
    }
    if (sup.creatinaOverrides === undefined) {
      updates['suplementos.creatinaOverrides'] = {};
    }
    // Contadores de tomas (Sub-fase 2B.5.b) · 0 por defecto.
    if (sup.batidos_tomados_total === undefined) {
      updates['suplementos.batidos_tomados_total'] = 0;
    }
    if (sup.creatinas_tomadas_total === undefined) {
      updates['suplementos.creatinas_tomadas_total'] = 0;
    }
    if (sup.creatinas_tomadas_semana === undefined) {
      updates['suplementos.creatinas_tomadas_semana'] = 0;
    }
    if (sup.creatinas_tomadas_mes === undefined) {
      updates['suplementos.creatinas_tomadas_mes'] = 0;
    }
    if (sup.creatina_semana_inicio === undefined) {
      updates['suplementos.creatina_semana_inicio'] = null;
    }
    if (sup.creatina_mes_inicio === undefined) {
      updates['suplementos.creatina_mes_inicio'] = null;
    }
    if (sup.last_batido_date === undefined) {
      updates['suplementos.last_batido_date'] = null;
    }
    if (sup.last_creatina_date === undefined) {
      updates['suplementos.last_creatina_date'] = null;
    }
    // Sub-fase 2B.5.b extension · contadores semanal/mensual del batido.
    if (sup.batidos_tomados_semana === undefined) {
      updates['suplementos.batidos_tomados_semana'] = 0;
    }
    if (sup.batidos_tomados_mes === undefined) {
      updates['suplementos.batidos_tomados_mes'] = 0;
    }
    if (sup.batido_semana_inicio === undefined) {
      updates['suplementos.batido_semana_inicio'] = null;
    }
    if (sup.batido_mes_inicio === undefined) {
      updates['suplementos.batido_mes_inicio'] = null;
    }
    // Sub-fase 2B.5.b extension · contador anual (año natural).
    if (sup.batidos_tomados_anio === undefined) {
      updates['suplementos.batidos_tomados_anio'] = 0;
    }
    if (sup.creatinas_tomadas_anio === undefined) {
      updates['suplementos.creatinas_tomadas_anio'] = 0;
    }
    if (sup.batido_anio_inicio === undefined) {
      updates['suplementos.batido_anio_inicio'] = null;
    }
    if (sup.creatina_anio_inicio === undefined) {
      updates['suplementos.creatina_anio_inicio'] = null;
    }
    // Migración stock dosis → stock gramos (Sub-fase 2B.5.b · v1 fidelity).
    // Docs creados antes de este cambio tienen `batidos_restantes` (dosis)
    // y `creatina_dosis_restantes` (dosis). Los convertimos a gramos
    // multiplicando por la dosis configurada y dejamos los campos legacy
    // simplemente sin tocar (Firestore tolera campos extra · al re-guardar
    // tampoco los reescribimos porque no están en el schema TS, así que
    // se quedan huérfanos · es aceptable). Si quisiéramos borrarlos
    // tendríamos que hacer una segunda pasada con FieldValue.delete().
    const supLegacy = raw.suplementos as Partial<Suplementos> & {
      batidos_restantes?: number | null;
      creatina_dosis_restantes?: number | null;
    };
    if (sup.batido_stock_gramos === undefined) {
      const dosis = supLegacy.batidos_restantes ?? null;
      const grPerDose = sup.batidoConfig?.gr_prot ?? 35;
      updates['suplementos.batido_stock_gramos'] =
        dosis === null ? null : Math.max(0, dosis * grPerDose);
    }
    if (sup.creatina_stock_gramos === undefined) {
      const dosis = supLegacy.creatina_dosis_restantes ?? null;
      const grPerDose = sup.creatinaConfig?.gr_dose ?? 3;
      updates['suplementos.creatina_stock_gramos'] =
        dosis === null ? null : Math.max(0, dosis * grPerDose);
    }
  }
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
    // objetivoKcal · null por defecto → se calcula al vuelo desde el resto
    // de campos del perfil (utils/calorias.ts).
    if (profile.objetivoKcal === undefined) profileUpdates['profile.objetivoKcal'] = null;
    Object.assign(updates, profileUpdates);
  }

  // ── Migración de `extras` en cada día del menú (Sub-fase 2B.5.b) ──
  // Docs creados antes de la feature de comidas extras tienen
  // `menu[day]` con solo {desayuno, comida, merienda, cena}. Añadimos
  // `extras: []` en cada día sin sobrescribir las 4 comidas existentes.
  // Usamos paths con punto · siguen mergeando a nivel de campo.
  const menuRaw = raw.menu as Record<string, Partial<ComidasDelDia>> | undefined;
  if (menuRaw) {
    for (const day of DAY_KEYS) {
      if (menuRaw[day] && menuRaw[day].extras === undefined) {
        updates[`menu.${day}.extras`] = [];
      }
    }
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
  // ⚠ Importante: `updates` puede contener keys con punto (ej.
  // 'suplementos.batidoConfig') porque Firestore las trata como paths para
  // hacer merge. Pero un spread `{ ...doc, ...updates }` interpretaría esa
  // string como key LITERAL y dejaría el campo sin anidar — el JSX leería
  // userDoc.suplementos.batidoConfig como undefined y al primer render
  // post-migración la app peta. applyDotPathUpdates anida los paths en una
  // copia limpia del doc para que el resultado refleje exactamente lo que
  // Firestore acaba de aplicar.
  const merged = applyDotPathUpdates(
    doc as unknown as Record<string, unknown>,
    updates,
  );
  return merged as unknown as UserDocument;
}

// Aplica una map de updates con keys posiblemente "a.b.c" (paths Firestore)
// a una copia del objeto base. Para cada path, anida los niveles necesarios
// y asigna el valor en la hoja. Niveles intermedios se shallow-clonan al
// descender · garantizamos que `base` no muta. Si un nivel intermedio no
// existe, lo creamos como `{}`.
function applyDotPathUpdates(
  base: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  // Shallow clone del top-level. Cada path mutado clona los niveles que
  // toca al descender · paths que comparten prefijo (`a.b.x` y `a.b.y`)
  // siguen consistentes porque al segundo paso `a.b` ya es la copia nueva.
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (!key.includes('.')) {
      result[key] = value;
      continue;
    }
    const parts = key.split('.');
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      const existing = cursor[segment];
      // Si no existe o no es objeto, lo arrancamos vacío.
      // Si es objeto, lo shallow-clonamos para no mutar el `base` original.
      const nextLevel: Record<string, unknown> =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? { ...(existing as Record<string, unknown>) }
          : {};
      cursor[segment] = nextLevel;
      cursor = nextLevel;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return result;
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
      if (!c) continue;
      if (c.source === undefined) return true;
      // Detectar también el viejo formato de alimentos como string[]
      // (Sub-fases 2B.0-2B.3) — en ese caso necesitamos remigrar para
      // convertirlos a Alimento[] con {nombre, cantidad}.
      const arr = c.alimentos as unknown[] | undefined;
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
        return true;
      }
    }
  }
  return false;
}

function withDefaultSourceInMenu(menu: Menu): Menu {
  const out = {} as Menu;
  for (const day of DAY_KEYS) {
    const dayMenu = menu[day] as Partial<ComidasDelDia> | undefined;
    out[day] = {
      desayuno: migrateComida(dayMenu?.desayuno, 'desayuno'),
      comida: migrateComida(dayMenu?.comida, 'comida'),
      merienda: migrateComida(dayMenu?.merienda, 'merienda'),
      cena: migrateComida(dayMenu?.cena, 'cena'),
      // Preservamos los extras existentes · esta función solo hace
      // migración de `source` en las 4 fijas, no toca los extras.
      extras: dayMenu?.extras ?? [],
    };
  }
  return out;
}

// Asegura que una comida tenga source y alimentos en el formato actual
// (Alimento[]). Si los alimentos vienen como string[] (formato viejo),
// los parsea con parseAlimentoString para extraer cantidad del final.
function migrateComida(c: Partial<Comida> | undefined, meal: MealKey): Comida {
  if (!c) return emptyMigrationComida(meal);
  let alimentos = (c.alimentos ?? []) as unknown[];
  // Migración formato viejo · alimentos era string[]
  if (alimentos.length > 0 && typeof alimentos[0] === 'string') {
    alimentos = (alimentos as string[]).map(parseAlimentoString);
  }
  return {
    alimentos: alimentos as Alimento[],
    hora: c.hora ?? null,
    kcal: c.kcal ?? 0,
    prot: c.prot ?? 0,
    carb: c.carb ?? 0,
    fat: c.fat ?? 0,
    source: c.source ?? 'default',
  };
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

// Actualiza solo algunos campos de una comida concreta del menú
// (`menu.{day}.{meal}.X`). Usado desde el editor de comida (Sub-fase 2B.3)
// con autosave debounced.
//
// Reglas:
//  - Cualquier edición del cliente marca la comida como source='user'
//    AUTOMÁTICAMENTE (a menos que el partial incluya `source` explícito).
//    Esto activa la regla "la IA no toca lo del user" en el AiGenerateModal.
//  - Si quieres saltarte la marca (ej. cuando la Cloud Function de Fase 6
//    escribe directamente con source='ai'), incluye `source` en el partial.
export async function updateUserMeal(
  uid: string,
  day: DayKey,
  meal: MealKey,
  partial: Partial<Comida>,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  for (const [key, value] of Object.entries(partial)) {
    updates[`menu.${day}.${meal}.${key}`] = value;
  }
  // Marca automática como 'user' si el caller no especifica source.
  if (!('source' in partial)) {
    updates[`menu.${day}.${meal}.source`] = 'user';
  }
  await mod.updateDoc(ref, updates);
}

// ── Comidas extras · Sub-fase 2B.5.b ────────────────────────────────────
//
// Los extras son comidas custom además de las 4 fijas. Se guardan como
// array en `menu.{day}.extras`. updateDoc no tiene "edita item por id"
// para arrays, así que el caller (provider) lee el array actual, lo
// modifica en local, y lo reescribe completo. Aquí solo damos los helpers
// que reescriben el array al final.
export async function setUserMealExtras(
  uid: string,
  day: DayKey,
  extras: ComidaExtra[],
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`menu.${day}.extras`]: extras,
    lastActive: Date.now(),
  });
}

// ── Contadores de tomas y stock · Sub-fase 2B.5.b ──────────────────────
//
// Setea el stock en GRAMOS (no en dosis · igual que el v1). null = "no
// definido" · la UI muestra placeholder. Usado desde el modal "Editar
// stock" cuando el user compra un bote nuevo y mete los gramos del bote.
// Las dosis posibles se calculan al vuelo en el cliente (`calcBatidoStats`
// / `calcCreatinaStats`) dividiendo entre la dosis configurada.
export async function setSupStockGramos(
  uid: string,
  kind: 'batido' | 'creatina',
  gramos: number | null,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const field =
    kind === 'batido'
      ? 'suplementos.batido_stock_gramos'
      : 'suplementos.creatina_stock_gramos';
  await mod.updateDoc(ref, {
    [field]: gramos,
    lastActive: Date.now(),
  });
}

// Aplica un patch arbitrario a `suplementos.*` con paths con punto. Útil
// para modificar varios contadores a la vez (ej. al "Tomar batido"
// incrementamos `batidos_tomados_total` y decrementamos
// `batidos_restantes` en una sola escritura atómica).
export async function patchSuplementos(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  for (const [key, value] of Object.entries(patch)) {
    updates[`suplementos.${key}`] = value;
  }
  await mod.updateDoc(ref, updates);
}

// Vacía una comida concreta del menú · usado al "Eliminar" desde MealSheet.
// Pone alimentos=[], hora=default, kcal/prot/carb/fat=0, source='default'.
// El revert (Deshacer) usa updateUserMeal con el snapshot · NO necesita
// helper especial porque updateUserMeal ya acepta partial Comida.
export async function clearUserMeal(
  uid: string,
  day: DayKey,
  meal: MealKey,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`menu.${day}.${meal}.alimentos`]: [],
    [`menu.${day}.${meal}.hora`]: HORA_DEFECTO[meal],
    [`menu.${day}.${meal}.kcal`]: 0,
    [`menu.${day}.${meal}.prot`]: 0,
    [`menu.${day}.${meal}.carb`]: 0,
    [`menu.${day}.${meal}.fat`]: 0,
    [`menu.${day}.${meal}.source`]: 'default',
    lastActive: Date.now(),
  });
}

// Setea (o borra) el override per-día de un suplemento. `override=null`
// elimina la entrada del map · el cliente leerá los defaults. Usamos
// FieldValue.delete() para que Firestore borre el campo en lugar de
// guardarlo como `null` · mantenemos el map limpio.
export async function setSupOverride(
  uid: string,
  kind: 'batido' | 'creatina',
  day: DayKey,
  override: SupDayOverride | null,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const field =
    kind === 'batido'
      ? `suplementos.batidoOverrides.${day}`
      : `suplementos.creatinaOverrides.${day}`;
  await mod.updateDoc(ref, {
    [field]: override === null ? mod.deleteField() : override,
    lastActive: Date.now(),
  });
}

// Duplica el contenido de una comida de origen (`menu.{srcDay}.{meal}`)
// hacia uno o varios días destino, manteniendo SIEMPRE la misma meal-key
// (Desayuno → Desayuno, Comida → Comida…). Una sola escritura `updateDoc`
// aunque haya N destinos · Firestore aplica todos los paths atómicamente.
//
// Decisiones de producto:
//  - El destino se marca como `source='user'` aunque la origen fuera 'ai',
//    porque duplicar es una intervención manual y bloquea reescritura por IA.
//  - Si el destino coincide con el origen lo filtramos (no es duplicar).
//  - Copiamos los campos editables de la comida (nombre, hora, alimentos,
//    macros). NO copiamos `source` literal · lo derivamos a 'user'.
export async function duplicateUserMeal(
  uid: string,
  srcDay: DayKey,
  meal: MealKey,
  comidaSrc: Comida,
  destDays: DayKey[],
): Promise<void> {
  const targets = destDays.filter((d) => d !== srcDay);
  if (targets.length === 0) return;
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  for (const day of targets) {
    updates[`menu.${day}.${meal}.hora`] = comidaSrc.hora;
    updates[`menu.${day}.${meal}.alimentos`] = comidaSrc.alimentos;
    updates[`menu.${day}.${meal}.kcal`] = comidaSrc.kcal;
    updates[`menu.${day}.${meal}.prot`] = comidaSrc.prot;
    updates[`menu.${day}.${meal}.carb`] = comidaSrc.carb;
    updates[`menu.${day}.${meal}.fat`] = comidaSrc.fat;
    updates[`menu.${day}.${meal}.source`] = 'user';
  }
  await mod.updateDoc(ref, updates);
}

// ── Suplementación · batido + creatina · Sub-fase 2B.5.a ───────────────────
//
// Guarda la receta global del batido. Path con punto para hacer merge
// dentro de `suplementos` y no pisar contadores ni la otra config.
export async function setBatidoConfig(
  uid: string,
  config: BatidoConfig,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    'suplementos.batidoConfig': config,
    lastActive: Date.now(),
  });
}

export async function setCreatinaConfig(
  uid: string,
  config: CreatinaConfig,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    'suplementos.creatinaConfig': config,
    lastActive: Date.now(),
  });
}

// Marca un día como "tiene batido/creatina añadido" o lo desmarca.
// Usamos arrayUnion / arrayRemove · idempotentes a nivel Firestore (si el
// día ya está en la lista, arrayUnion no duplica · si no estaba,
// arrayRemove no falla). Esto evita race conditions si el user pulsa el
// botón rápido varias veces seguidas.
export async function toggleSupInDay(
  uid: string,
  kind: 'batido' | 'creatina',
  day: DayKey,
  on: boolean,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const field =
    kind === 'batido'
      ? 'suplementos.daysWithBatido'
      : 'suplementos.daysWithCreatina';
  await mod.updateDoc(ref, {
    [field]: on ? mod.arrayUnion(day) : mod.arrayRemove(day),
    lastActive: Date.now(),
  });
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
