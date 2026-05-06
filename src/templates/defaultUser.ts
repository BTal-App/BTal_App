// Estructura del documento /users/{uid} en Firestore.
// Solo el bloque `profile` se llena en el onboarding inicial; el resto
// (plan_pro, fecha_expiracion, fecha_ultima_generacion) se gestionará desde
// Cloud Functions cuando integremos Stripe + Gemini en Fase 6 y 7.

import type { Preferences } from '../utils/units';

export type Sexo = 'm' | 'f';

export type NivelActividad =
  | 'sedentario'
  | 'ligero'
  | 'moderado'
  | 'activo'
  | 'muy_activo';

export type Equipamiento = 'gimnasio' | 'casa' | 'sin_material';

export type Objetivo = 'volumen' | 'definicion' | 'recomposicion' | 'mantenimiento';

export type Restriccion =
  | 'vegano'
  | 'vegetariano'
  | 'sin_lactosa'
  | 'sin_gluten'
  | 'sin_frutos_secos';

// Modo de generación del plan: 'manual' (el usuario lo rellena) o 'ai'
// (Cloud Function + Gemini). Hoy solo manual está cableado; ai queda como
// flag preparado para Fase 6.
export type Modo = 'manual' | 'ai';

// Cuando el usuario elige 'ai' debe decidir QUÉ secciones quiere que la
// IA genere. Esta es la "preferencia por defecto" — la primera generación
// post-onboarding usa esta elección. Después, cada botón "Regenerar con
// IA" de cada tab tiene su propia mini-elección que NO modifica este
// campo (ej. el user pidió 'all' al registrarse y luego solo regenera
// entrenos puntualmente desde la tab Entreno).
//
// - 'all'           · menú semanal + lista de la compra + plan de entreno
// - 'menu_compra'   · menú + compra (sin entrenos · los rellena el user)
// - 'menu_only'     · solo menú (sin compra ni entrenos)
// - 'entrenos_only' · solo entrenos (nutrición la rellena el user)
//
// Si modo === 'manual' este campo es null (no aplica).
export type AiScopeChoice = 'all' | 'menu_compra' | 'menu_only' | 'entrenos_only';

// Valor que emite el componente <StepMode> · vive aquí (junto al resto
// de tipos de dominio) para evitar que el modal de cambio en Settings
// y el onboarding tengan que importar de un archivo de UI.
export interface StepModeValue {
  modo: Modo | null;
  aiScope: AiScopeChoice | null;
}

export interface UserProfile {
  // Datos personales
  nombre: string;
  edad: number | null;
  peso: number | null; // kg
  altura: number | null; // cm
  sexo: Sexo | null;

  // Estilo de vida
  actividad: NivelActividad | null;
  diasEntreno: number | null; // 0-7
  equipamiento: Equipamiento | null;

  // Objetivo
  objetivo: Objetivo | null;
  restricciones: Restriccion[];

  // Modo de generación
  modo: Modo;
  // Subdivisión de modo='ai' · qué secciones genera la IA. Null si manual.
  // La elección se hace en el paso 4 del onboarding (junto a la elección
  // de modo) y se puede cambiar luego desde Settings → Modo de generación.
  aiScope: AiScopeChoice | null;

  // Marca que indica si el onboarding terminó. La app comprueba este flag
  // tras login para decidir entre /onboarding y /app.
  completed: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// MENÚ NUTRICIONAL
//
// 7 días × 4 comidas. Mismo schema en modo IA (Gemini lo rellena) y manual
// (el user lo edita comida a comida). Macros se almacenan numéricos para
// poder sumar el total del día sin parseos. Una comida sin alimentos se
// considera "vacía" — los empty states de la UI miran `alimentos.length`.

export type DayKey = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type MealKey = 'desayuno' | 'comida' | 'merienda' | 'cena';

export interface Comida {
  // Lista de líneas tipo "Avena 60g", "Plátano mediano", "Pechuga 180g".
  alimentos: string[];
  // Hora HH:mm en 24h, opcional — si no se pone la app usa la hora por
  // defecto del MealKey (08:00, 14:00, 17:30, 21:00).
  hora: string | null;
  kcal: number;
  prot: number; // g
  carb: number; // g
  fat: number; // g
}

export type Menu = Record<DayKey, Record<MealKey, Comida>>;

// ────────────────────────────────────────────────────────────────────────────
// ENTRENOS
//
// 7 planes preestablecidos (de 1 a 7 días). El user elige cuál es su plan
// activo en `planActivo`. Cada plan tiene N días con sus ejercicios. En
// modo manual los ejercicios empiezan vacíos; en modo IA los rellena
// Gemini con peso+series+reps según el perfil.

export type TipoEjercicio = 'fuerza' | 'hipertrofia' | 'cardio' | 'movilidad';

export interface Ejercicio {
  nombre: string;
  // Series y rango de reps · ej: "4×6-8", "3×12", "30 min".
  setsReps: string;
  // Notas técnicas opcionales · ej: "calentamiento progresivo".
  nota?: string;
  // Peso de referencia para el plan (kg). El registro real va en otra
  // colección (registros/{fecha}) — esto es solo el "peso objetivo".
  pesoKg: number | null;
  tipo: TipoEjercicio;
}

export interface DiaEntreno {
  // Letra (A/B/C/...) y nombre tipo "Empuje", "Tirón", "Pierna", "Descanso".
  letra: string;
  nombre: string;
  // Etiquetas para los chips: "Pecho · Tríceps · Hombros".
  tags: string[];
  // Día de la semana al que está asignado · null = sin asignar.
  diaSemana: DayKey | null;
  ejercicios: Ejercicio[];
  // Minutos estimados · null si no se ha calculado.
  duracionMin: number | null;
}

export interface PlanEntreno {
  // Días de la semana que entrena (1..7). El array tiene length === diasPorSemana.
  diasPorSemana: number;
  // Nombre legible · "Plan 4 días — Push/Pull/Legs".
  nombre: string;
  dias: DiaEntreno[];
}

// `1` | `2` | ... | `7` como claves para evitar colisiones de tipo.
export type PlanesEntreno = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, PlanEntreno>;

export interface Entrenos {
  planes: PlanesEntreno;
  // El plan que el user usa actualmente (1..7) · null = sin elegir aún.
  // Recomendación inicial = profile.diasEntreno.
  planActivo: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
}

// ────────────────────────────────────────────────────────────────────────────
// LISTA DE LA COMPRA
//
// 7 categorías fijas. Cada item tiene cantidad libre, precio estimado y
// flag de comprado. La lista la genera la IA a partir del menú o la
// rellena el user a mano.

export type CategoriaCompraKey =
  | 'proteinas'
  | 'lacteos'
  | 'hidratos'
  | 'frutas_verduras'
  | 'despensa'
  | 'grasas'
  | 'suplementacion';

export interface ItemCompra {
  nombre: string;
  cantidad: string; // "750g", "1 docena", "2 unidades"
  comprado: boolean;
  // Precio estimado en € · null si aún no se conoce.
  precio: number | null;
}

export type Compra = Record<CategoriaCompraKey, ItemCompra[]>;

// ────────────────────────────────────────────────────────────────────────────
// SUPLEMENTACIÓN
//
// Contadores de dosis restantes para que la tab Hoy avise cuando se está
// acabando algo. Cada uno es opcional · null = el user no toma ese suple.

export interface Suplementos {
  // Batido proteico (whey/iso) · dosis típicas de 35g.
  batidos_restantes: number | null;
  // Creatina monohidrato · 3-5g/día.
  creatina_dosis_restantes: number | null;
  // Espacio para crecer · vitamina D, omega-3, etc. en futuras versiones.
}

// ────────────────────────────────────────────────────────────────────────────
// MONETIZACIÓN E IA · plan + límites de generación
//
// Modelo de negocio (decidido en Fase 2A):
//   - Free        · 1 generación al mes (total, no por sección)
//   - Pago único  · 4,99€ → adelanta 1 generación extra YA (caduca a los 30d)
//   - Pro         · 9,99€/mes → generaciones ilimitadas mientras esté activo
//
// La regeneración GRANULAR (solo menú, solo entrenos) cuenta como 1 gen
// completa en Free → opción 1 estricta. Esto es decisión de producto.
//
// La compra NO se regenera con IA — se deriva automáticamente del menú
// (ingredientes agregados por categoría). El user puede añadir productos
// extra a la lista (suplementos, despensa, etc.) que no provienen del menú.

export type PlanTipo = 'free' | 'one_off' | 'pro';

export interface PlanIA {
  tipo: PlanTipo;
  // Para 'one_off' y 'pro': ms epoch en que caduca el beneficio.
  // - 'free': null (no caduca, siempre activo)
  // - 'one_off': now + 30 días al pagar
  // - 'pro': now + 30 días, renovable mensualmente vía webhook Stripe
  vence_en: number | null;
  // Solo aplica a 'one_off' · marca si ya gastó la gen extra del pago.
  one_off_consumido: boolean;
}

// Scope de una regeneración IA. La compra NO está aquí porque no se
// regenera con IA, se deriva del menú.
export type ScopeIA = 'all' | 'menu' | 'entrenos';

export interface GeneracionesIA {
  // Última generación de cada scope · ms epoch o null si nunca.
  // Lo lee la UI para mostrar "Última generación: hace X días" en cada tab.
  menu_at: number | null;
  entrenos_at: number | null;
  // Generaciones consumidas en el ciclo actual. La Cloud Function
  // `generatePlan` lo incrementa al ejecutar y resetea cada 30 días.
  // En Free: máx 1. En Pro: ignorado (función no comprueba límite).
  consumidas_ciclo: number;
  // Inicio del ciclo actual · ms epoch.
  // Si now - ciclo_inicio > 30d, la Cloud Function resetea consumidas_ciclo
  // y avanza ciclo_inicio antes de comprobar el límite.
  ciclo_inicio: number;
}

export function defaultPlan(): PlanIA {
  return { tipo: 'free', vence_en: null, one_off_consumido: false };
}

export function defaultGeneraciones(): GeneracionesIA {
  return {
    menu_at: null,
    entrenos_at: null,
    consumidas_ciclo: 0,
    ciclo_inicio: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────

export interface UserDocument {
  profile: UserProfile;

  // Preferencias UI (sistema de unidades, inicio de semana). Optional —
  // se rellenan en cuanto el usuario las toca en Settings (o se migran
  // automáticamente desde localStorage la primera vez que un invitado
  // se hace cuenta real). Si está undefined, los consumidores caen a
  // DEFAULT_PREFERENCES.
  preferences?: Preferences;

  // ── Datos de la app (Fase 2 en adelante) ──
  // Estos campos contienen TODA la información que cada tab del shell v2
  // muestra al usuario. En modo manual los rellena el user; en modo IA
  // los rellena la Cloud Function `generatePlan` que llama a Gemini.
  // En invitado se pre-cargan con `demoUser` para que la app se entienda
  // de un vistazo.
  menu: Menu;
  entrenos: Entrenos;
  compra: Compra;
  suplementos: Suplementos;

  // ── Monetización + IA (gestionados desde Cloud Functions, no cliente) ──
  // Estado del plan de pago. La Cloud Function `stripeWebhook` lo actualiza
  // al recibir eventos de Stripe (compra única, suscripción nueva, cancelación).
  plan: PlanIA;
  // Rastreo granular de generaciones por scope (menú, entrenos) + contador
  // del ciclo de 30 días. La Cloud Function `generatePlan` lo gestiona.
  generaciones: GeneracionesIA;

  // ── Campos legacy · DEPRECATED ──
  // Se mantienen por retrocompatibilidad con docs anteriores a Fase 2A.
  // La Cloud Function `generatePlan` los actualiza junto con los nuevos
  // mientras existan docs migrándose. Eliminar en Fase 6 cuando todos
  // los docs estén migrados con `plan` y `generaciones`.
  /** @deprecated usar `plan.tipo === 'pro'` */
  plan_pro: boolean;
  /** @deprecated usar `plan.vence_en` */
  fecha_expiracion: number | null;
  /** @deprecated usar `generaciones.menu_at` o `generaciones.entrenos_at` */
  fecha_ultima_generacion: number | null;

  // Metadata
  createdAt: number; // ms epoch — set en la primera escritura
  lastActive: number; // ms epoch — actualizado al entrar al dashboard

  // Aviso médico/legal (roadmap 14-2). Se rellena con el timestamp en
  // que el usuario aceptó el disclaimer en el paso 1 del onboarding.
  // Valor null en docs antiguos sin aceptación registrada — la app
  // pedirá re-aceptación en futuras versiones si se necesita evidencia.
  medicalDisclaimerAcceptedAt: number | null;

  // Marca al doc como sembrado con `demoUser` (modo prueba). Útil para
  // mostrar el banner "Modo prueba — datos no permanentes" sin tener
  // que mirar `user.isAnonymous` desde Auth en cada tab.
  isDemo?: boolean;
}

export function defaultProfile(): UserProfile {
  return {
    nombre: '',
    edad: null,
    peso: null,
    altura: null,
    sexo: null,
    actividad: null,
    diasEntreno: null,
    equipamiento: null,
    objetivo: null,
    restricciones: [],
    modo: 'manual',
    aiScope: null,
    completed: false,
  };
}

// ── Factories vacías (manual) ──
// Devuelven la estructura completa pero sin datos. Punto de partida para
// usuarios nuevos en cualquier modo (IA o manual). En modo IA se llenan
// con la respuesta de Gemini; en manual el user va rellenando.

export const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
export const MEAL_KEYS: MealKey[] = ['desayuno', 'comida', 'merienda', 'cena'];

export const HORA_DEFECTO: Record<MealKey, string> = {
  desayuno: '08:00',
  comida: '14:00',
  merienda: '17:30',
  cena: '21:00',
};

export const CATEGORIAS_COMPRA: { key: CategoriaCompraKey; label: string; emoji: string }[] = [
  { key: 'proteinas', label: 'Proteínas', emoji: '💪' },
  { key: 'lacteos', label: 'Lácteos', emoji: '🥛' },
  { key: 'hidratos', label: 'Hidratos', emoji: '🌾' },
  { key: 'frutas_verduras', label: 'Frutas y verduras', emoji: '🥦' },
  { key: 'despensa', label: 'Despensa', emoji: '🛒' },
  { key: 'grasas', label: 'Grasas', emoji: '🥑' },
  { key: 'suplementacion', label: 'Suplementación', emoji: '🧪' },
];

function emptyComida(meal: MealKey): Comida {
  return {
    alimentos: [],
    hora: HORA_DEFECTO[meal],
    kcal: 0,
    prot: 0,
    carb: 0,
    fat: 0,
  };
}

export function defaultMenu(): Menu {
  const out = {} as Menu;
  for (const day of DAY_KEYS) {
    out[day] = {
      desayuno: emptyComida('desayuno'),
      comida: emptyComida('comida'),
      merienda: emptyComida('merienda'),
      cena: emptyComida('cena'),
    };
  }
  return out;
}

// Devuelve los 7 planes (1..7 días) con sus días vacíos y nombres genéricos.
// La distribución mínima viable es Empuje/Tirón/Pierna y descansos. La IA
// cuando llegue refinará nombres/tags/ejercicios según objetivo.
export function defaultEntrenos(): Entrenos {
  // Genera N días vacíos con letra (A, B, C, ...). Sin diaSemana asignado.
  const emptyDias = (n: number): DiaEntreno[] => {
    const letras = 'ABCDEFG';
    return Array.from({ length: n }, (_, i) => ({
      letra: letras[i],
      nombre: `Día ${letras[i]}`,
      tags: [],
      diaSemana: null,
      ejercicios: [],
      duracionMin: null,
    }));
  };

  const planes: PlanesEntreno = {
    1: { diasPorSemana: 1, nombre: 'Plan 1 día', dias: emptyDias(1) },
    2: { diasPorSemana: 2, nombre: 'Plan 2 días', dias: emptyDias(2) },
    3: { diasPorSemana: 3, nombre: 'Plan 3 días', dias: emptyDias(3) },
    4: { diasPorSemana: 4, nombre: 'Plan 4 días', dias: emptyDias(4) },
    5: { diasPorSemana: 5, nombre: 'Plan 5 días', dias: emptyDias(5) },
    6: { diasPorSemana: 6, nombre: 'Plan 6 días', dias: emptyDias(6) },
    7: { diasPorSemana: 7, nombre: 'Plan 7 días', dias: emptyDias(7) },
  };
  return { planes, planActivo: null };
}

export function defaultCompra(): Compra {
  return {
    proteinas: [],
    lacteos: [],
    hidratos: [],
    frutas_verduras: [],
    despensa: [],
    grasas: [],
    suplementacion: [],
  };
}

export function defaultSuplementos(): Suplementos {
  return {
    batidos_restantes: null,
    creatina_dosis_restantes: null,
  };
}

export function defaultUserDocument(): UserDocument {
  const now = Date.now();
  return {
    profile: defaultProfile(),
    menu: defaultMenu(),
    entrenos: defaultEntrenos(),
    compra: defaultCompra(),
    suplementos: defaultSuplementos(),
    plan: defaultPlan(),
    generaciones: defaultGeneraciones(),
    plan_pro: false,
    fecha_expiracion: null,
    fecha_ultima_generacion: null,
    createdAt: now,
    lastActive: now,
    medicalDisclaimerAcceptedAt: null,
  };
}

// Etiquetas humanas para mostrar en UI · centralizadas para reutilizar entre
// onboarding, perfil y dashboard.
export const NIVELES_ACTIVIDAD: { value: NivelActividad; label: string; sub: string }[] = [
  { value: 'sedentario', label: 'Sedentario', sub: 'Poca o ninguna actividad física' },
  { value: 'ligero', label: 'Ligero', sub: '1-3 días/semana de ejercicio ligero' },
  { value: 'moderado', label: 'Moderado', sub: '3-5 días/semana de ejercicio moderado' },
  { value: 'activo', label: 'Activo', sub: '6-7 días/semana de ejercicio intenso' },
  { value: 'muy_activo', label: 'Muy activo', sub: 'Entreno dos veces al día' },
];

export const EQUIPAMIENTOS: { value: Equipamiento; label: string; sub: string }[] = [
  { value: 'gimnasio', label: 'Gimnasio', sub: 'Acceso a máquinas y peso libre' },
  { value: 'casa', label: 'En casa', sub: 'Mancuernas, gomas o similar' },
  { value: 'sin_material', label: 'Sin material', sub: 'Solo peso corporal' },
];

export const OBJETIVOS: { value: Objetivo; label: string; sub: string }[] = [
  { value: 'volumen', label: 'Volumen', sub: 'Ganar masa muscular' },
  { value: 'definicion', label: 'Definición', sub: 'Perder grasa, mantener músculo' },
  { value: 'recomposicion', label: 'Recomposición', sub: 'Ganar músculo y perder grasa' },
  { value: 'mantenimiento', label: 'Mantenimiento', sub: 'Conservar el peso y la forma actuales' },
];

export const RESTRICCIONES: { value: Restriccion; label: string }[] = [
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin_lactosa', label: 'Sin lactosa' },
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'sin_frutos_secos', label: 'Sin frutos secos' },
];

// Opciones de scope IA — etiquetas humanas + descripción.
// Reusadas en StepMode (onboarding y modal de cambio) y en AiGenerateModal
// (modal del botón "Generar con IA" de cada tab). El emoji está pensado
// para no depender de Ionicons en el flujo de onboarding (más rápido de
// renderizar) — los modales pueden mapearlo a un IonIcon si quieren.
export const AI_SCOPE_OPTIONS: {
  value: AiScopeChoice;
  label: string;
  sub: string;
  emoji: string;
}[] = [
  {
    value: 'all',
    label: 'Todo el plan',
    sub: 'Menú semanal con su lista de la compra y plan de entreno.',
    emoji: '✨',
  },
  {
    value: 'menu_compra',
    label: 'Menú + lista de compra',
    sub: 'Solo nutrición. El plan de entreno lo rellenas tú.',
    emoji: '🍽️',
  },
  {
    value: 'menu_only',
    label: 'Solo menú',
    sub: 'Recetas semanales sin generar la lista de la compra.',
    emoji: '📋',
  },
  {
    value: 'entrenos_only',
    label: 'Solo entrenos',
    sub: 'Plan de entrenamiento. La nutrición la rellenas tú.',
    emoji: '🏋️',
  },
];

// Helper: filtra AI_SCOPE_OPTIONS por las opciones disponibles en un
// contexto concreto (Hoy = todas, Menú = 2, Entreno = 1).
export function aiScopeOptions(values: AiScopeChoice[]) {
  return AI_SCOPE_OPTIONS.filter((o) => values.includes(o.value));
}
