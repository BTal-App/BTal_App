import type { Firestore } from 'firebase/firestore';
import { app } from './firebase';
import { syncAuthDisplayName } from './auth';
import { toTitleCase } from '../utils/userDisplay';
import {
  COMPRA_BUILTIN_IDS,
  DAY_KEYS,
  DEFAULT_COMPRA_CATEGORIAS,
  HORA_DEFECTO,
  MAX_EXERCISE_HISTORY,
  MEAL_KEYS,
  defaultBatidoConfig,
  defaultCompra,
  defaultCreatinaConfig,
  defaultEntrenos,
  defaultGeneraciones,
  getRecommendedPlanId,
  defaultMenu,
  defaultMenuFlags,
  defaultPlan,
  defaultRegistroStats,
  defaultSuplementos,
  defaultUserDocument,
  maxKgEjercicio,
  newCompraItemId,
  normalizeExerciseName,
  parseAlimentoString,
  type Alimento,
  type BatidoConfig,
  type CategoriaCompra,
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
  type PlanEntreno,
  type RegistroDia,
  type RegistroStats,
  type SourceTag,
  type SupDayOverride,
  type Suplementos,
  type UserDocument,
  type UserProfile,
} from '../templates/defaultUser';
import { demoUserDocument, generateDemoRegistros } from '../templates/demoUser';
import type { Preferences } from '../utils/units';

// Toda lectura/escritura a Firestore pasa por aquí.
// Los componentes nunca llaman a Firestore directamente.
//
// Firestore se carga bajo demanda: el chunk (~150 KB gz) solo entra en el
// bundle cuando se invoca alguna de estas funciones por primera vez.

// Sentinel local para señalar que un path debe eliminarse del doc
// Firestore. Lo usamos en `updates` durante la migración para no tener
// que pasar `mod` por todo el árbol de helpers — al final, antes del
// `updateDoc`, traducimos cada DELETE_FIELD al sentinel real
// `mod.deleteField()` que devuelve el SDK. Doble función:
//   1. updateDoc recibe el sentinel real → Firestore borra el campo.
//   2. applyDotPathUpdates detecta DELETE_FIELD y `delete`-a la propiedad
//      en la copia local del doc · así el doc devuelto refleja el estado
//      post-migración sin tener un FieldValue colgado en memoria.
const DELETE_FIELD: unique symbol = Symbol('DELETE_FIELD');

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
  // Normalizamos `nombre` a Title Case ANTES de persistir · cualquier
  // variación de mayúsculas del input ("pablo", "PABLO", "Pablo") queda
  // canonicalizada como "Pablo". Idempotente: si ya viene bien, no cambia.
  const completedProfile: UserProfile = {
    ...profile,
    nombre: toTitleCase(profile.nombre),
    completed: true,
  };

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
    if (data.entrenos === undefined) {
      // El activePlan default de defaultEntrenos() es '4dias' (hardcode
      // demo). Cuando se siembra a un user real durante onboarding, ese
      // valor debe respetar los `diasEntreno` que el user acaba de elegir:
      // si dijo 5 días → activePlan='5dias'. Sin esto, el banner muestra
      // el plan recomendado pero la selección por defecto es '4dias',
      // generando una desincronía visual.
      updates.entrenos = {
        ...defaultEntrenos(),
        activePlan: getRecommendedPlanId(profile.diasEntreno),
      };
    }
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
    // vacíos — punto de partida idéntico para modos IA y manual. El
    // activePlan se ajusta a los diasEntreno del perfil (ver comentario
    // arriba en el path existing.exists()).
    const initial: UserDocument = {
      ...defaultUserDocument(),
      profile: completedProfile,
      medicalDisclaimerAcceptedAt: now,
      entrenos: {
        ...defaultEntrenos(),
        activePlan: getRecommendedPlanId(profile.diasEntreno),
      },
    };
    await mod.setDoc(ref, initial);
  }
  // Sync con Firebase Auth · si el user firma con email/password no tiene
  // displayName · al guardar el perfil del onboarding lo seteamos a
  // `profile.nombre` para que el avatar (greet, iniciales, etc.) lo lea
  // del lugar canónico. Idempotente: si ya coincide, no escribe.
  // (Usamos `completedProfile.nombre` que YA está en Title Case · evita que
  // el sync escriba la versión sin normalizar.)
  await syncAuthDisplayName(completedProfile.nombre);
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
    // Histórico fechado de tomas (Sub-fase 2E.1) · []
    // en docs pre-2E.1. La lógica de marcar/incrementar empieza a
    // poblarlo desde la primera escritura post-migración.
    if (sup.batidoHistory === undefined) {
      updates['suplementos.batidoHistory'] = [];
    }
    if (sup.creatinaHistory === undefined) {
      updates['suplementos.creatinaHistory'] = [];
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
    // multiplicando por la dosis configurada y, ahora también, marcamos
    // los campos legacy para borrado con `DELETE_FIELD` · al traducirse a
    // `mod.deleteField()` justo antes del updateDoc, Firestore los elimina
    // del doc atomicamente con el resto de la migración. Solo los marcamos
    // si realmente existen en el doc (`'k' in obj`) — evita escrituras
    // innecesarias en docs ya migrados o nuevos.
    const supLegacy = raw.suplementos as Partial<Suplementos> &
      Record<string, unknown> & {
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
    // Borrado explícito de los campos legacy huérfanos. Idempotente: si
    // ya no están en el doc (porque ya pasaron por esta migración antes
    // o el doc nunca los tuvo), no entramos al if y no se añade nada al
    // payload de update.
    if ('batidos_restantes' in supLegacy) {
      updates['suplementos.batidos_restantes'] = DELETE_FIELD;
    }
    if ('creatina_dosis_restantes' in supLegacy) {
      updates['suplementos.creatina_dosis_restantes'] = DELETE_FIELD;
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
  // Metadata · `createdAt` y `lastActive` son campos obligatorios del
  // `UserDocument` (no opcionales). `saveOnboardingProfile` y
  // `seedGuestDocument` ya los siembran al crear, pero docs creados
  // antes de Fase 2A o por scripts pueden carecer de ellos. Si el
  // campo falta, lo inicializamos a "ahora" como aproximación —
  // mejor un timestamp ligeramente impreciso que tener `undefined`
  // donde el JSX espera number.
  const nowMs = Date.now();
  if (raw.createdAt === undefined) updates.createdAt = nowMs;
  if (raw.lastActive === undefined) updates.lastActive = nowMs;
  // Flags por día (Fase 2B.6) · array vacío en docs viejos.
  if (raw.menuFlags === undefined) {
    updates.menuFlags = defaultMenuFlags();
  }
  // Stats agregadas del registro de pesos (Sub-fase 2E) · vacías en
  // docs viejos. La transacción `setRegistroDia` las recalcula a partir
  // de aquí en cada save · cuentas viejas siguen funcionando con stats
  // 0/0/0 hasta que el user empiece a registrar pesos.
  if (raw.registroStats === undefined) {
    updates.registroStats = defaultRegistroStats();
  }

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
  // Migración Sub-fase 2D · doc viejo con `planes: {1..7}` numérico,
  // `planActivo: number`, ejercicios con `setsReps/pesoKg/tipo`, días
  // con `letra/nombre/tags/duracionMin` → nuevo shape con `planes:
  // Record<string, PlanEntreno>`, `activePlan: string`, badges, etc.
  // Se hace ANTES de la migración de source/id.
  const rawEntrenos = (raw.entrenos ?? updates.entrenos) as unknown;
  if (isLegacyEntrenosShape(rawEntrenos)) {
    updates.entrenos = migrateLegacyEntrenos(
      rawEntrenos as Record<string, unknown>,
    );
  }
  const entrenos = (updates.entrenos ?? rawEntrenos) as Entrenos | undefined;
  if (entrenos && entrenosNeedsSourceMigration(entrenos)) {
    updates.entrenos = withDefaultSourceInEntrenos(entrenos);
  }
  // Migración Sub-fase 2C · doc viejo `{proteinas: [], lacteos: [], ...}`
  // → nuevo shape `{categorias: CategoriaCompra[], items: Record<id,
  // ItemCompra[]>}`. Se hace ANTES de las migraciones de source/id
  // porque el shape tiene que ser correcto antes de iterar `items`.
  const rawCompra = (raw.compra ?? updates.compra) as unknown;
  if (isLegacyCompraShape(rawCompra)) {
    updates.compra = migrateLegacyCompra(rawCompra as Record<string, unknown>);
  }
  const compra = (updates.compra ?? rawCompra) as Compra | undefined;
  if (compra && compraNeedsSourceMigration(compra)) {
    updates.compra = withDefaultSourceInCompra(compra);
  }

  if (Object.keys(updates).length === 0) return doc;

  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  // Traducción de DELETE_FIELD → mod.deleteField() solo en el payload que
  // viaja a Firestore. El objeto local `updates` (que applyDotPathUpdates
  // recorre justo después) sigue con el símbolo, que sí sabe interpretar.
  const firestorePayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    firestorePayload[k] = v === DELETE_FIELD ? mod.deleteField() : v;
  }
  await mod.updateDoc(ref, firestorePayload);
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
    const isDelete = value === DELETE_FIELD;
    if (!key.includes('.')) {
      if (isDelete) {
        delete result[key];
      } else {
        result[key] = value;
      }
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
    const leafKey = parts[parts.length - 1];
    if (isDelete) {
      delete cursor[leafKey];
    } else {
      cursor[leafKey] = value;
    }
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

// Detecta el shape LEGACY (pre-Sub-fase 2D) · `planes` indexado por
// 1..7 numérico + `planActivo: number | null` + `Ejercicio.setsReps` /
// `pesoKg` / `tipo` + `DiaEntreno.letra` / `nombre` / `tags` /
// `duracionMin`. El nuevo shape tiene `planes: Record<string, ...>` +
// `activePlan: string` + `Ejercicio.series` / `desc` + `DiaEntreno.titulo`
// / `descripcion` / badges.
function isLegacyEntrenosShape(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  // El nuevo shape tiene activePlan (string). Si tiene planActivo
  // (numeric/null) o solo planes con keys "1".."7" → legacy.
  if (typeof obj.activePlan === 'string' && obj.activePlan) return false;
  if ('planActivo' in obj) return true;
  const planes = obj.planes as Record<string, unknown> | undefined;
  if (!planes) return false;
  // Si todas las keys son números 1..7, es legacy.
  return Object.keys(planes).every((k) => /^[1-7]$/.test(k));
}

// Convierte un doc entrenos LEGACY al nuevo shape. Réplica del
// `migrateLegacyCompra` · siembra los 7 builtIn limpios y rellena con
// los datos del legacy lo que pueda mapear (titulo<-letra+nombre,
// descripcion<-tags, series<-setsReps, desc<-nota).
function migrateLegacyEntrenos(legacy: Record<string, unknown>): Entrenos {
  const fresh = defaultEntrenos();
  const legacyPlanes = legacy.planes as Record<string, unknown> | undefined;
  if (!legacyPlanes) return fresh;
  // Mapeo numérico → builtIn id.
  const NUMS = ['1', '2', '3', '4', '5', '6', '7'] as const;
  for (const num of NUMS) {
    const oldPlan = legacyPlanes[num] as
      | { dias?: unknown[]; nombre?: string }
      | undefined;
    if (!oldPlan?.dias?.length) continue;
    const planId = `${num}dias`;
    const oldDias = Array.isArray(oldPlan.dias) ? oldPlan.dias : [];
    const newDias: DiaEntreno[] = oldDias.map((d) => {
      const old = d as {
        letra?: string;
        nombre?: string;
        tags?: string[];
        diaSemana?: DayKey | null;
        ejercicios?: unknown[];
        source?: SourceTag;
      };
      const titulo = old.letra
        ? `Día ${old.letra}${old.nombre ? ` · ${old.nombre}` : ''}`
        : old.nombre || 'Día';
      const ejercicios: Ejercicio[] = Array.isArray(old.ejercicios)
        ? old.ejercicios.map((rawEj) => {
            const e = rawEj as {
              nombre?: string;
              setsReps?: string;
              series?: string;
              nota?: string;
              desc?: string;
              source?: SourceTag;
            };
            return {
              nombre: e.nombre ?? '',
              desc: e.desc ?? e.nota ?? '',
              series: e.series ?? e.setsReps ?? '',
              source: e.source ?? 'default',
            };
          })
        : [];
      return {
        titulo,
        descripcion: Array.isArray(old.tags) ? old.tags.join(' · ') : '',
        // Sub-fase 2D · tiempo estimado · null (no existía en legacy).
        tiempoEstimadoMin: null,
        diaSemana: old.diaSemana ?? null,
        // No teníamos badges en legacy · campos vacíos.
        badge: '',
        badgeCustom: '',
        badge2: '',
        badgeCustom2: '',
        badge3: '',
        badgeCustom3: '',
        ejercicios,
        comentario: '',
        source: old.source ?? 'default',
      };
    });
    if (fresh.planes[planId]) {
      fresh.planes[planId] = {
        ...fresh.planes[planId],
        nombre: oldPlan.nombre ?? fresh.planes[planId].nombre,
        dias: newDias,
      };
    }
  }
  // activePlan derivado de planActivo legacy (number | null) · si no
  // existe o es null, mantenemos el default '4dias'.
  const oldActive = legacy.planActivo as number | null | undefined;
  if (typeof oldActive === 'number' && oldActive >= 1 && oldActive <= 7) {
    fresh.activePlan = `${oldActive}dias`;
  }
  return fresh;
}

// Convierte un valor que debería ser DiaEntreno[] pero puede llegar
// como objeto `{ '0': dia, '1': dia, ... }` (corrupción Firestore tras
// dot-path con índice numérico). El bug anterior de setUserDiaEntreno
// dejó docs así · al detectarlos los reconstruimos como array
// ordenado por las keys numéricas.
function coerceDiasArray(dias: unknown): DiaEntreno[] {
  if (Array.isArray(dias)) return dias as DiaEntreno[];
  if (dias && typeof dias === 'object') {
    const obj = dias as Record<string, DiaEntreno>;
    const numericKeys = Object.keys(obj)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return numericKeys.map((k) => obj[k]).filter(Boolean);
  }
  return [];
}

// Devuelve el número de días esperado para un plan builtIn según su
// id (`4dias` → 4). Para custom plans, devuelve null (no hay número
// esperado, el user define cuántos días tiene).
function expectedDiasForBuiltIn(planId: string): number | null {
  const m = /^([1-7])dias$/.exec(planId);
  return m ? parseInt(m[1], 10) : null;
}

function entrenosNeedsSourceMigration(entrenos: Entrenos): boolean {
  if (!entrenos?.planes) return false;
  for (const [id, plan] of Object.entries(entrenos.planes)) {
    if (!plan) continue;
    // Detectamos `dias` no-array (corrupción Firestore) · forzamos
    // la migración para reconstruir el array desde el map.
    if (!Array.isArray(plan.dias)) return true;
    // Detectamos builtIn plans con número de días incorrecto · el
    // bug del dot-path numérico borró días al sobreescribir, así
    // que un plan builtIn que ahora tenga ≠N días es recuperable
    // con re-seed (sólo lo hacemos si BIDIRECCIONALMENTE faltan
    // días, no si el user simplemente cambió el plan).
    const expected = expectedDiasForBuiltIn(id);
    if (
      expected !== null
      && plan.builtIn
      && plan.dias.length !== expected
    ) {
      return true;
    }
    for (const dia of plan.dias) {
      const d = dia as Partial<DiaEntreno>;
      if (d.source === undefined) return true;
      // Sub-fase 2D · campo nuevo `tiempoEstimadoMin` en DiaEntreno.
      // Si falta en docs viejos, forzamos migración.
      if ((d as Partial<DiaEntreno>).tiempoEstimadoMin === undefined) return true;
      if (!Array.isArray(dia.ejercicios)) continue;
      for (const ej of dia.ejercicios) {
        if ((ej as Partial<Ejercicio>).source === undefined) return true;
      }
    }
  }
  return false;
}

function withDefaultSourceInEntrenos(entrenos: Entrenos): Entrenos {
  const defaults = defaultEntrenos();
  const planesOut: Record<string, PlanEntreno> = {};
  for (const [id, plan] of Object.entries(entrenos.planes)) {
    if (!plan) continue;
    // coerceDiasArray repara el array si Firestore lo dejó como
    // `{0: dia, 1: dia, …}` por el bug del dot-path numérico.
    const dias = coerceDiasArray(plan.dias);
    const expected = expectedDiasForBuiltIn(id);
    // Recuperación de plans builtIn corruptos · si el plan dice ser
    // builtIn (1dias..7dias) pero le faltan días, lo re-sembramos
    // desde defaultEntrenos. Esto cubre el caso donde el bug del
    // dot-path borró días al editar (la única forma de que un
    // builtIn tenga ≠N días es por corrupción · v2 nunca permite
    // añadir/quitar días en un builtIn sin pasar por save full).
    if (
      expected !== null
      && plan.builtIn
      && dias.length !== expected
      && defaults.planes[id]
    ) {
      console.warn(
        `[BTal] Plan builtIn corrupto · ${id} tenía ${dias.length} día(s),`
        + ` esperados ${expected}. Restaurando a default.`,
      );
      planesOut[id] = defaults.planes[id];
      continue;
    }
    planesOut[id] = {
      ...plan,
      dias: dias.map((d) => ({
        ...ensureSource(d),
        // Sub-fase 2D · `tiempoEstimadoMin` puede no existir en docs
        // viejos · default null (sin tiempo definido).
        tiempoEstimadoMin:
          (d as Partial<DiaEntreno>).tiempoEstimadoMin ?? null,
        ejercicios: Array.isArray(d.ejercicios)
          ? d.ejercicios.map((ej) => ensureSource(ej))
          : [],
      })),
    };
  }
  return { ...entrenos, planes: planesOut };
}

function compraNeedsSourceMigration(compra: Compra): boolean {
  if (!compra || !compra.items) return false;
  for (const items of Object.values(compra.items)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if ((item as Partial<ItemCompra>).source === undefined) return true;
      if ((item as Partial<ItemCompra>).id === undefined) return true;
    }
  }
  return false;
}

function withDefaultSourceInCompra(compra: Compra): Compra {
  const itemsOut: Record<string, ItemCompra[]> = {};
  for (const [catId, items] of Object.entries(compra.items)) {
    itemsOut[catId] = Array.isArray(items)
      ? items.map((item) => {
          const withSource = ensureSource(item);
          // ID estable · si el item viene de un doc viejo sin id, lo
          // generamos ahora (idempotente: si ya tiene id, lo respeta).
          if (!withSource.id) {
            return { ...withSource, id: newCompraItemId() };
          }
          return withSource;
        })
      : [];
  }
  return { categorias: compra.categorias, items: itemsOut };
}

// Detecta el shape LEGACY (pre-Sub-fase 2C) · objeto plano con keys
// `proteinas`, `lacteos`, ... cada uno apuntando a un array de items.
// El nuevo shape tiene `categorias` (array) + `items` (record).
function isLegacyCompraShape(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const obj = c as Record<string, unknown>;
  // Si tiene `categorias` array O `items` object, ya es nuevo shape.
  if (Array.isArray(obj.categorias) || (obj.items && typeof obj.items === 'object')) {
    return false;
  }
  // Si tiene al menos una de las 7 keys builtIn como array → legacy.
  return COMPRA_BUILTIN_IDS.some((cat) => Array.isArray(obj[cat]));
}

// Convierte un doc compra LEGACY (shape de pre-2C) al nuevo shape.
// Las 7 categorías builtIn se siembran con sus defaults; los items
// existentes se preservan (con id generado si no lo tienen).
function migrateLegacyCompra(legacy: Record<string, unknown>): Compra {
  const itemsOut: Record<string, ItemCompra[]> = {};
  for (const cat of COMPRA_BUILTIN_IDS) {
    const arr = legacy[cat];
    if (!Array.isArray(arr)) {
      itemsOut[cat] = [];
      continue;
    }
    itemsOut[cat] = arr.map((it) => {
      const partial = (it ?? {}) as Partial<ItemCompra>;
      return {
        id: partial.id ?? newCompraItemId(),
        nombre: partial.nombre ?? '',
        cantidad: partial.cantidad ?? '',
        comprado: partial.comprado ?? false,
        precio: partial.precio ?? null,
        source: partial.source ?? 'default',
      };
    });
  }
  return {
    categorias: DEFAULT_COMPRA_CATEGORIAS.map((c) => ({ ...c })),
    items: itemsOut,
  };
}

// Siembra el documento de un usuario invitado (sesión anónima) con el
// `demoUser` completo. Idempotente: si el doc ya existe (porque el invitado
// ya entró en una sesión anterior y editó algo), no lo pisa.
//
// Sub-fase 2E.1 · al primer login también siembra la subcolección
// `/users/{uid}/registros/{fecha}` con varios registros de los últimos
// días · permite al invitado ver el calendar de Registro y los gráficos
// con datos reales sin tener que registrar él mismo. Los writes de
// registros van en paralelo con `Promise.all` · 4-6 round-trips · acepable.
//
// Lo llama Landing.tsx justo después de signInAnonymously. La razón de
// que esté aquí y no en Landing es que el modelo de datos vive en este
// servicio — Landing solo orquesta el flujo, no decide qué se siembra.
// TTL del invitado · días desde la CREACIÓN del doc antes de
// auto-borrar. La rule de Firestore TTL (configurada en Firebase
// Console sobre `/users/expiresAt`) hará el barrido.
//
// Política: 3 días fijos desde la creación, NO se renueva en cada
// visita. Si un invitado activo entra todos los días, igualmente el
// doc se borra al cumplirse 3 días. Esto evita que invitados "zombi"
// (usan la app pero no se registran) acumulen datos indefinidamente,
// y obliga a la conversión a cuenta real en un plazo razonable.
const GUEST_TTL_DAYS = 3;

// Calcula el Timestamp inicial al que `expiresAt` debe apuntar al
// crear por primera vez el doc del invitado. Se llama UNA SOLA VEZ
// dentro de seedGuestDocument (rama de doc nuevo). Una vez sembrado
// no se vuelve a tocar.
function guestExpiresAt(mod: typeof import('firebase/firestore')) {
  return mod.Timestamp.fromMillis(Date.now() + GUEST_TTL_DAYS * 86400 * 1000);
}

export async function seedGuestDocument(uid: string): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const existing = await mod.getDoc(ref);
  if (existing.exists()) {
    // El invitado ya tiene doc · no lo pisamos. Solo refrescamos
    // lastActive. NO tocamos expiresAt · el plazo de 3 días corre
    // desde la creación original del doc, no desde esta visita.
    await mod.setDoc(ref, { lastActive: Date.now() }, { merge: true });
    return;
  }
  // Doc principal con todos los demo + TTL inicial (3 días desde ahora).
  // Es la ÚNICA vez en toda la vida del doc que se setea expiresAt.
  await mod.setDoc(ref, { ...demoUserDocument(), expiresAt: guestExpiresAt(mod) });
  // Subcolección /registros · entries demo de los últimos 6 días.
  // Promise.all paraleliza los writes (4-6 round-trips concurrentes).
  const registros = generateDemoRegistros();
  await Promise.all(
    registros.map((r) => {
      const regRef = mod.doc(db, 'users', uid, 'registros', r.fecha);
      return mod.setDoc(regRef, r);
    }),
  );
}

// Quita el campo `expiresAt` del doc · usado tras vincular cuenta
// (anonymous → real). El doc pasa a tener vida indefinida · no caduca
// más. `deleteField()` es el sentinel oficial de Firestore para
// "borrar este campo" en un updateDoc · idempotente, no falla si el
// campo no existe (cuentas reales desde el principio nunca lo
// tuvieron · llamarlo igual no rompe nada).
export async function clearGuestExpiration(uid: string): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, { expiresAt: mod.deleteField() });
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
//
// La política TTL del invitado se decide al crear el doc en
// `seedGuestDocument` (3 días desde creación, sin renovación). Esta
// función NO toca `expiresAt`.
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
  // Si el patch trae `nombre`, lo normalizamos a Title Case antes de
  // persistir · misma regla que en `saveOnboardingProfile`. Calculamos el
  // titled aquí para reusarlo en el sync de Auth y evitar normalizar dos
  // veces (la versión sin normalizar nunca llega al storage).
  const titledNombre = Object.prototype.hasOwnProperty.call(partial, 'nombre')
    ? toTitleCase(partial.nombre)
    : undefined;
  for (const [key, value] of Object.entries(partial)) {
    // Salvaguarda: nunca permitimos "descompletar" el perfil ni cambiar
    // el modo de generación desde este helper (ese flujo va por otra ruta).
    if (key === 'completed') continue;
    updates[`profile.${key}`] = key === 'nombre' ? titledNombre : value;
  }
  await mod.updateDoc(ref, updates);
  // Si el patch toca `nombre`, sincronizamos también el displayName de Auth
  // para que ambos campos queden alineados. Solo cuando el campo está
  // explícitamente en el partial (no propagamos cambios fantasma).
  if (titledNombre !== undefined) {
    await syncAuthDisplayName(titledNombre);
  }
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

// Duplica una `ComidaExtra` a uno o varios días destino. A diferencia
// de las 4 fijas, los extras viven en un array por día (`menu.{day}.
// extras`), así que el caller debe pasarnos el array final ya
// construido por día. Aquí solo escribimos todos los paths en una
// única `updateDoc` para que Firestore lo aplique atómicamente.
export async function duplicateUserMealExtras(
  uid: string,
  // Mapa `{ day → array completo final de extras }`. El provider lo
  // construye con los extras actuales + la copia nueva (con id propio).
  perDay: Partial<Record<DayKey, ComidaExtra[]>>,
): Promise<void> {
  const entries = Object.entries(perDay) as Array<[DayKey, ComidaExtra[]]>;
  if (entries.length === 0) return;
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  for (const [day, extras] of entries) {
    updates[`menu.${day}.extras`] = extras;
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

// ── Lista de la compra · Sub-fase 2C ─────────────────────────────────
// Reemplaza toda la `compra` del user · usado para acciones que
// modifican varias categorías a la vez (reset checks, reordenar
// categorías, derivar del menú). Optimistic update + revert se
// gestionan en el provider.
export async function setUserCompra(
  uid: string,
  compra: Compra,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    compra,
    lastActive: Date.now(),
  });
}

// Reemplaza solo los items de UNA categoría · path con punto evita
// pisar el resto de categorías. Usado en add/update/remove de un
// solo item dentro de una cat.
export async function setUserCompraItemsOfCategoria(
  uid: string,
  catId: string,
  items: ItemCompra[],
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`compra.items.${catId}`]: items,
    lastActive: Date.now(),
  });
}

// Reemplaza el array de categorías (sin tocar items). Usado al
// renombrar/reordenar/cambiar emoji de categorías existentes.
export async function setUserCompraCategorias(
  uid: string,
  categorias: CategoriaCompra[],
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    'compra.categorias': categorias,
    lastActive: Date.now(),
  });
}

// Setea los flags por día del menú · `excludedFromAvg` y/o `hidden`
// (Sub-fase 2B.6). Ambos son DayKey[]. Mismo patrón que setUserMeal:
// merge atómico vía updateDoc con paths con punto.
export async function setUserMenuFlags(
  uid: string,
  flags: { excludedFromAvg?: DayKey[]; hidden?: DayKey[] },
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const updates: Record<string, unknown> = { lastActive: Date.now() };
  if (flags.excludedFromAvg !== undefined) {
    updates['menuFlags.excludedFromAvg'] = flags.excludedFromAvg;
  }
  if (flags.hidden !== undefined) {
    updates['menuFlags.hidden'] = flags.hidden;
  }
  await mod.updateDoc(ref, updates);
}

// Reemplaza las 4 comidas + extras de un día concreto · usado al
// "Resetear día" (Sub-fase 2B.6). Una sola escritura atómica con todos
// los campos del día. La fuente del default la decide el caller
// (defaultMenu()[day] para cuentas reales, demoUser.menu[day] para
// invitados). El paciente no es la fuente — esta función solo escribe.
export async function setUserDayComidas(
  uid: string,
  day: DayKey,
  comidas: ComidasDelDia,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`menu.${day}`]: comidas,
    lastActive: Date.now(),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Entrenos · Sub-fase 2D · CRUD planes y días.
// ──────────────────────────────────────────────────────────────────────────

// Setea el plan activo (id de un plan en `entrenos.planes`).
export async function setUserActivePlan(
  uid: string,
  planId: string,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    'entrenos.activePlan': planId,
    lastActive: Date.now(),
  });
}

// Setea (crea o reemplaza) un plan completo en `entrenos.planes.{id}`.
// Usado al guardar el editor de plan (modo nuevo o edición).
export async function setUserPlanEntreno(
  uid: string,
  plan: PlanEntreno,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`entrenos.planes.${plan.id}`]: plan,
    lastActive: Date.now(),
  });
}

// Borra un plan completo · solo aplica a planes custom (los builtIn
// no se pueden eliminar). El caller valida que `plan.builtIn === false`.
export async function deleteUserPlanEntreno(
  uid: string,
  planId: string,
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  await mod.updateDoc(ref, {
    [`entrenos.planes.${planId}`]: mod.deleteField(),
    lastActive: Date.now(),
  });
}

// Setea un día concreto dentro de un plan. ⚠ NO usamos dot-path con
// índice numérico (`entrenos.planes.{id}.dias.{idx}`) porque Firestore
// trata esos paths como propiedades de objeto: convierte `dias: [...]`
// en `dias: { '0': ..., '1': ... }` (map), corrompiendo el array. Al
// recargar, `plan.dias.map(...)` falla con TypeError.
//
// Solución: leer el plan actual, modificar el día en memoria, y
// reescribir el array completo en `entrenos.planes.{id}.dias`. El
// caller pasa los `currentDias` (state local del provider) para
// evitar un re-fetch — es el array que ya tenía cargado el cliente.
export async function setUserDiaEntreno(
  uid: string,
  planId: string,
  diaIdx: number,
  dia: DiaEntreno,
  currentDias: DiaEntreno[],
): Promise<void> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, 'users', uid);
  const next = [...currentDias];
  next[diaIdx] = dia;
  await mod.updateDoc(ref, {
    [`entrenos.planes.${planId}.dias`]: next,
    lastActive: Date.now(),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Registro de pesos · Sub-fase 2E · subcolección /users/{uid}/registros
// ──────────────────────────────────────────────────────────────────────────
//
// Cada doc tiene como id la fecha 'YYYY-MM-DD' y contiene un `RegistroDia`
// (plan elegido, exercises map, notas, updatedAt). Las stats agregadas
// (`totalEntrenos`, `prs`, `exerciseHistory`) viven en el doc del user
// bajo `registroStats` y se mantienen vía `runTransaction` al guardar/
// borrar para garantizar consistencia. La racha NO se persiste · se
// calcula en `useRegistroStats` leyendo los últimos 60 días.

// Path helper · centralizado para que si cambia la nomenclatura solo
// se toque aquí.
function registroDocPath(uid: string, fecha: string): [string, string, string, string] {
  return ['users', uid, 'registros', fecha];
}

// Considera "registrado" un día con plan asignado (entreno o descanso
// explícito). Plan vacío significa que el doc nunca debería estar
// persistido · `setRegistroDia` rechaza ese caso para mantener la
// invariante "si existe doc, plan != ''".
function isRegistrado(reg: RegistroDia | null): boolean {
  return !!reg && reg.plan !== '';
}

// Aplica el delta entre el registro previo y el nuevo a las stats
// existentes. Función PURA · ningún side effect · útil para tests.
//
// Reglas:
//  - totalEntrenos: +1 si pasa de no-registrado a registrado · -1 al revés.
//  - exerciseHistory: para cada ex en `next.exercises`, reemplaza la
//    entry de esa fecha con el nuevo maxKg (o lo borra si maxKg=0).
//    Para cada ex en prev pero NO en next, borra la entry de esa fecha.
//  - prs: solo se actualiza al ALZA (best-effort · ver nota en
//    `RegistroStats.prs`). No hay rollback al editar/borrar.
function applyRegistroDelta(
  prevStats: RegistroStats,
  prev: RegistroDia | null,
  next: RegistroDia,
): RegistroStats {
  const out: RegistroStats = {
    totalEntrenos: prevStats.totalEntrenos,
    prs: { ...prevStats.prs },
    exerciseHistory: { ...prevStats.exerciseHistory },
  };

  const wasReg = isRegistrado(prev);
  const willBeReg = isRegistrado(next);
  if (!wasReg && willBeReg) out.totalEntrenos += 1;
  else if (wasReg && !willBeReg) out.totalEntrenos = Math.max(0, out.totalEntrenos - 1);

  const fecha = next.fecha;
  const seenNorms = new Set<string>();

  // Para cada ejercicio en `next.exercises`: refresh history entry de
  // esa fecha + bump PR si procede.
  for (const [exName, ej] of Object.entries(next.exercises ?? {})) {
    const exNorm = normalizeExerciseName(exName);
    if (!exNorm) continue;
    seenNorms.add(exNorm);
    const newMax = maxKgEjercicio(ej);

    let arr = (out.exerciseHistory[exNorm] ?? []).filter((e) => e.fecha !== fecha);
    if (newMax > 0) arr.push({ fecha, maxKg: newMax });
    arr.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    if (arr.length > MAX_EXERCISE_HISTORY) {
      arr = arr.slice(-MAX_EXERCISE_HISTORY);
    }
    if (arr.length === 0) delete out.exerciseHistory[exNorm];
    else out.exerciseHistory[exNorm] = arr;

    const curPR = out.prs[exNorm];
    if (newMax > 0 && (!curPR || newMax > curPR.kg)) {
      out.prs[exNorm] = { kg: newMax, fecha };
    }
  }

  // Para cada ejercicio en prev que YA NO está en next: limpiar su
  // history entry de fecha. No tocamos PRs (best-effort).
  if (prev) {
    for (const exName of Object.keys(prev.exercises ?? {})) {
      const exNorm = normalizeExerciseName(exName);
      if (!exNorm || seenNorms.has(exNorm)) continue;
      const arr = (out.exerciseHistory[exNorm] ?? []).filter((e) => e.fecha !== fecha);
      if (arr.length === 0) delete out.exerciseHistory[exNorm];
      else out.exerciseHistory[exNorm] = arr;
    }
  }

  return out;
}

// Aplica el delta de un borrado · resta totalEntrenos si estaba
// registrado y limpia entries de history para esa fecha. Sin rollback
// de PRs (best-effort).
function applyRegistroDelete(
  prevStats: RegistroStats,
  prev: RegistroDia,
): RegistroStats {
  const out: RegistroStats = {
    totalEntrenos: prevStats.totalEntrenos,
    prs: { ...prevStats.prs },
    exerciseHistory: { ...prevStats.exerciseHistory },
  };
  if (isRegistrado(prev)) {
    out.totalEntrenos = Math.max(0, out.totalEntrenos - 1);
  }
  const fecha = prev.fecha;
  for (const exName of Object.keys(prev.exercises ?? {})) {
    const exNorm = normalizeExerciseName(exName);
    if (!exNorm) continue;
    const arr = (out.exerciseHistory[exNorm] ?? []).filter((e) => e.fecha !== fecha);
    if (arr.length === 0) delete out.exerciseHistory[exNorm];
    else out.exerciseHistory[exNorm] = arr;
  }
  return out;
}

// Lee un registro concreto (un día) · null si no existe.
export async function getRegistroDia(
  uid: string,
  fecha: string,
): Promise<RegistroDia | null> {
  const { mod, db } = await getDb();
  const ref = mod.doc(db, ...registroDocPath(uid, fecha));
  const snap = await mod.getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as RegistroDia;
}

// Devuelve el primer día (inclusive) y el último (exclusivo) en formato
// 'YYYY-MM-DD' para la query por id de un mes concreto. Útil para
// `getRegistroMes` y `subscribeRegistroMes`. month0 es 0-11.
function monthRangeKeys(year: number, month0: number): { startInc: string; endExc: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startInc = `${year}-${pad(month0 + 1)}-01`;
  const endY = month0 === 11 ? year + 1 : year;
  const endM0 = month0 === 11 ? 0 : month0 + 1;
  const endExc = `${endY}-${pad(endM0 + 1)}-01`;
  return { startInc, endExc };
}

// Lee TODOS los registros de un mes concreto · devuelve map fecha → reg.
// Una sola query (~31 docs máx) usando documentId() como filtro.
export async function getRegistroMes(
  uid: string,
  year: number,
  month0: number,
): Promise<Record<string, RegistroDia>> {
  const { mod, db } = await getDb();
  const col = mod.collection(db, 'users', uid, 'registros');
  const { startInc, endExc } = monthRangeKeys(year, month0);
  const q = mod.query(
    col,
    mod.where(mod.documentId(), '>=', startInc),
    mod.where(mod.documentId(), '<', endExc),
  );
  const snap = await mod.getDocs(q);
  const out: Record<string, RegistroDia> = {};
  snap.forEach((d) => {
    out[d.id] = d.data() as RegistroDia;
  });
  return out;
}

// Suscripción reactiva a los registros de un mes · onSnapshot. El cb
// recibe el map completo (re-emitido en cada cambio). Devuelve la
// función de unsubscribe para que el caller la llame en cleanup.
export async function subscribeRegistroMes(
  uid: string,
  year: number,
  month0: number,
  cb: (byDate: Record<string, RegistroDia>) => void,
): Promise<() => void> {
  const { mod, db } = await getDb();
  const col = mod.collection(db, 'users', uid, 'registros');
  const { startInc, endExc } = monthRangeKeys(year, month0);
  const q = mod.query(
    col,
    mod.where(mod.documentId(), '>=', startInc),
    mod.where(mod.documentId(), '<', endExc),
  );
  return mod.onSnapshot(q, (snap) => {
    const out: Record<string, RegistroDia> = {};
    snap.forEach((d) => {
      out[d.id] = d.data() as RegistroDia;
    });
    cb(out);
  });
}

// Lee los últimos N registros (orderBy id desc) · usado por
// `useRegistroStats` para calcular la racha on-the-fly. Limit 60 da
// margen suficiente para una racha máxima realista (un usuario que
// entrena/descansa cada día durante 2 meses).
//
// IMPORTANTE · ordenamos por el campo `fecha` (denormalizado · igual
// al doc id `YYYY-MM-DD`) en lugar de `documentId()` porque Firestore
// requiere un índice compuesto explícito para `orderBy(documentId,
// 'desc')` en colecciones (auto-índice solo cubre ASC). El campo
// `fecha` es un single-field auto-indexed que cubre ambas direcciones
// y produce el mismo orden lexicográfico que el doc id.
export async function getRegistrosRecientes(
  uid: string,
  limit: number = 60,
): Promise<RegistroDia[]> {
  const { mod, db } = await getDb();
  const col = mod.collection(db, 'users', uid, 'registros');
  const q = mod.query(col, mod.orderBy('fecha', 'desc'), mod.limit(limit));
  const snap = await mod.getDocs(q);
  const out: RegistroDia[] = [];
  snap.forEach((d) => out.push(d.data() as RegistroDia));
  return out;
}

// Lee TODOS los registros del user · devuelve map fecha → reg, sin
// filtro de rango. Usado por el export GDPR (`services/exportData.ts`)
// donde tenemos que entregar el historial completo del usuario, no una
// ventana. Cada doc pesa ≤ 50 KB (regla Firestore) y un usuario realista
// no supera unos cientos de docs, así que la query entera cabe en una
// sola Promise sin paginar.
export async function getAllRegistros(
  uid: string,
): Promise<Record<string, RegistroDia>> {
  const { mod, db } = await getDb();
  const col = mod.collection(db, 'users', uid, 'registros');
  const snap = await mod.getDocs(col);
  const out: Record<string, RegistroDia> = {};
  snap.forEach((d) => {
    out[d.id] = d.data() as RegistroDia;
  });
  return out;
}

// Ventana deslizante de la subcolección /registros · máximo de docs
// que conservamos por usuario. Al añadir un día NUEVO que haría pasar
// de este tope, borramos los más antiguos (FIFO) para que la colección
// nunca crezca sin límite (~2,7 años de histórico · de sobra para la
// racha, los gráficos y "Total registrado"). Coincide con
// `RACHA_FETCH_LIMIT` de useRegistroStats y el fetch de GraphsModal,
// así lo que se ve = lo que existe.
export const REGISTROS_MAX = 999;

// Poda FIFO best-effort · se llama tras (no dentro de) la transacción
// de setRegistroDia, solo cuando se creó un día NUEVO. NO recalcula
// `registroStats`: "Total registrado", PRs e historial son agregados
// de por vida en el user doc · borrar docs antiguos de /registros es
// solo limpieza de almacenamiento, no debe bajar el contador total.
// Si falla (red), no es crítico · el siguiente save lo reintenta.
async function pruneOldRegistros(uid: string): Promise<void> {
  try {
    const { mod, db } = await getDb();
    const col = mod.collection(db, 'users', uid, 'registros');
    // count() agregado · 1 lectura sea cual sea el tamaño.
    const countSnap = await mod.getCountFromServer(col);
    const total = countSnap.data().count;
    if (total <= REGISTROS_MAX) return;

    const excess = total - REGISTROS_MAX;
    // Los más antiguos · `fecha` (= doc id YYYY-MM-DD) asc.
    const q = mod.query(col, mod.orderBy('fecha', 'asc'), mod.limit(excess));
    const snap = await mod.getDocs(q);

    // writeBatch · máx 500 ops/commit. `excess` normalmente es 1
    // (un día nuevo desborda de 999→1000) · troceamos por robustez.
    let batch = mod.writeBatch(db);
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      n += 1;
      if (n % 450 === 0) {
        await batch.commit();
        batch = mod.writeBatch(db);
      }
    }
    if (n % 450 !== 0) await batch.commit();
  } catch (err) {
    console.warn('[BTal] pruneOldRegistros (no crítico):', err);
  }
}

// Guarda un registro · escribe el doc + actualiza `registroStats` del
// user en una transacción atómica. Devuelve las nuevas stats para que
// el provider sincronice estado local sin re-leer el doc del user.
//
// Tras la tx, si se creó un día NUEVO, dispara pruneOldRegistros
// (fire-and-forget) para mantener la ventana de REGISTROS_MAX días.
//
// Lanza si:
//   - `next.plan === ''` (no hay registro real que persistir; usar
//     `deleteRegistroDia` si quieres limpiar el día).
//   - El user doc no existe (no debería ocurrir post-onboarding).
export async function setRegistroDia(
  uid: string,
  fecha: string,
  next: RegistroDia,
): Promise<RegistroStats> {
  if (!next.plan) {
    throw new Error('setRegistroDia: plan vacío · usa deleteRegistroDia para limpiar');
  }
  const { mod, db } = await getDb();
  const userRef = mod.doc(db, 'users', uid);
  const regRef = mod.doc(db, ...registroDocPath(uid, fecha));

  let createdNew = false;
  const newStats = await mod.runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('setRegistroDia: user document no existe');
    }
    const regSnap = await tx.get(regRef);
    createdNew = !regSnap.exists();
    const userData = userSnap.data() as UserDocument;
    const prevReg = regSnap.exists() ? (regSnap.data() as RegistroDia) : null;
    const prevStats = userData.registroStats ?? defaultRegistroStats();

    const nextWithTimestamp: RegistroDia = { ...next, fecha, updatedAt: Date.now() };
    const stats = applyRegistroDelta(prevStats, prevReg, nextWithTimestamp);

    tx.set(regRef, nextWithTimestamp);
    tx.update(userRef, {
      registroStats: stats,
      lastActive: Date.now(),
    });

    return stats;
  });

  // Solo poda si añadimos un día NUEVO (editar uno existente no crece
  // la colección). Fire-and-forget · no bloquea el guardado ni propaga
  // errores al caller (el save ya fue exitoso).
  if (createdNew) {
    void pruneOldRegistros(uid);
  }

  return newStats;
}

// Borra el registro de un día · idem con tx + recalc stats. Devuelve
// las nuevas stats. Idempotente: si el doc no existía, devuelve las
// stats sin tocar (no escribe el user doc).
export async function deleteRegistroDia(
  uid: string,
  fecha: string,
): Promise<RegistroStats> {
  const { mod, db } = await getDb();
  const userRef = mod.doc(db, 'users', uid);
  const regRef = mod.doc(db, ...registroDocPath(uid, fecha));

  return mod.runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('deleteRegistroDia: user document no existe');
    }
    const regSnap = await tx.get(regRef);
    const userData = userSnap.data() as UserDocument;
    const prevStats = userData.registroStats ?? defaultRegistroStats();
    if (!regSnap.exists()) return prevStats;

    const prevReg = regSnap.data() as RegistroDia;
    const newStats = applyRegistroDelete(prevStats, prevReg);

    tx.delete(regRef);
    tx.update(userRef, {
      registroStats: newStats,
      lastActive: Date.now(),
    });

    return newStats;
  });
}
