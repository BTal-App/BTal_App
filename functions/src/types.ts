// Tipos compartidos de las Cloud Functions de BTal.
//
// NOTA: este paquete (functions/) es un proyecto npm independiente del
// frontend (btal/src). No importamos de ../src porque tienen tsconfig y
// módulo distintos. Espejamos aquí el subconjunto de tipos que las
// funciones necesitan leer del UserDocument y escribir de vuelta. Si el
// schema del frontend cambia, hay que reflejarlo aquí (son contratos
// estables · cambian poco).

export type DayKey = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type MealKey = 'desayuno' | 'comida' | 'merienda' | 'cena';

export const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
export const MEAL_KEYS: MealKey[] = ['desayuno', 'comida', 'merienda', 'cena'];

// Hora por defecto de cada comida fija (si la IA no especifica una).
export const MEAL_DEFAULT_HORA: Record<MealKey, string> = {
  desayuno: '08:00',
  comida: '14:00',
  merienda: '17:30',
  cena: '21:00',
};

type Sexo = 'm' | 'f';
type NivelActividad =
  | 'sedentario'
  | 'ligero'
  | 'moderado'
  | 'activo'
  | 'muy_activo';
type Equipamiento = 'gimnasio' | 'casa' | 'sin_material';
type Objetivo = 'volumen' | 'definicion' | 'recomposicion' | 'mantenimiento';

// Scope de generación que llega del cliente (AiGenerateModal).
export type AiScopeChoice = 'all' | 'menu_compra' | 'menu_only' | 'entrenos_only';

// Tag de origen de cada item (comida/ejercicio/plan).
export type SourceTag = 'default' | 'user' | 'ai' | 'ai-estimated';

type PlanTipo = 'free' | 'one_off' | 'pro';

// ── Subconjunto del UserProfile que las funciones leen ──
interface UserProfile {
  nombre: string;
  edad: number | null;
  peso: number | null;
  altura: number | null;
  sexo: Sexo | null;
  actividad: NivelActividad | null;
  diasEntreno: number | null;
  equipamiento: Equipamiento | null;
  objetivo: Objetivo | null;
  restricciones: string[];
  notas: string;
  intolerancias: string[];
  alergias: string[];
  alimentosProhibidos: string[];
  alimentosObligatorios: string[];
  ingredientesFavoritos: string[];
  objetivoKcal: number | null;
  modo: 'ai' | 'manual';
  aiScope: AiScopeChoice | null;
  // Preferencia de supermercados (Fase 6B) · opcional · puede no existir.
  supermercados?: string[];
  completed: boolean;
}

export interface PlanIA {
  tipo: PlanTipo;
  vence_en: number | null;
  one_off_consumido: boolean;
}

export interface GeneracionesIA {
  menu_at: number | null;
  entrenos_at: number | null;
  consumidas_ciclo: number;
  ciclo_inicio: number;
}

// ── Shapes de persistencia (lo que ESCRIBIMOS en Firestore) ──

interface Alimento {
  nombre: string;
  cantidad: string;
  // 6B-B · solo si el alimento viene del buscador/barcode (OFF). Macros por
  // 100 g + marca, para recalcular el total de la comida al cambiar la
  // cantidad. La IA no los rellena (su path resuelve macros aparte).
  source?: 'off' | 'manual';
  brand?: string;
  kcalPer100?: number;
  protPer100?: number;
  carbPer100?: number;
  fatPer100?: number;
}

export interface Comida {
  alimentos: Alimento[];
  hora: string | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  source: SourceTag;
  emoji?: string | null;
  nombrePlato?: string | null;
}

// Comida extra · slot adicional a las 4 fijas. Mismo shape que el frontend
// (defaultUser.ts ComidaExtra): id estable, nombre (título del slot),
// deshabilitada (pausada · no suma). Toda extra se renderiza con el chip
// "EXTRA". La IA puede generar extras (almuerzo/media mañana/recena).
export interface ComidaExtra extends Comida {
  id: string;
  nombre: string;
  deshabilitada?: boolean;
}

export interface ComidasDelDia {
  desayuno: Comida;
  comida: Comida;
  merienda: Comida;
  cena: Comida;
  // Extras: las del user (source!=='ai') SIEMPRE se preservan · las de la IA
  // (source==='ai') se regeneran. El user puede deshabilitarlas/borrarlas.
  extras: ComidaExtra[];
}

export type Menu = Record<DayKey, ComidasDelDia>;

export type EjercicioBadge =
  | 'pecho' | 'espalda' | 'piernas' | 'hombros' | 'biceps' | 'triceps'
  | 'core' | 'fullbody' | 'fuerza' | 'hipertrofia' | 'resistencia'
  | 'cardio' | 'movilidad' | 'empuje' | 'tiron' | 'custom' | '';

interface Ejercicio {
  nombre: string;
  desc: string;
  series: string;
  source: SourceTag;
}

export interface DiaEntreno {
  titulo: string;
  descripcion: string;
  tiempoEstimadoMin: number | null;
  diaSemana: DayKey | null;
  badge: EjercicioBadge;
  badgeCustom: string;
  badge2: EjercicioBadge;
  badgeCustom2: string;
  badge3: EjercicioBadge;
  badgeCustom3: string;
  ejercicios: Ejercicio[];
  comentario: string;
  source: SourceTag;
}

export interface PlanEntreno {
  id: string;
  nombre: string;
  estructura: string;
  estructura2: string;
  dias: DiaEntreno[];
  builtIn: boolean;
  activo?: boolean;
}

export interface Entrenos {
  activePlan: string;
  planes: Record<string, PlanEntreno>;
}

export interface ItemCompra {
  id: string;
  nombre: string;
  cantidad: string;
  comprado: boolean;
  precio: number | null;
  source: SourceTag;
}

interface CategoriaCompra {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  order: number;
  builtIn: boolean;
}

export interface Compra {
  categorias: CategoriaCompra[];
  items: Record<string, ItemCompra[]>;
}

// Récord por ejercicio · clave = nombre normalizado (minúsculas). Solo
// necesitamos el kg máximo para guiar progresiones en el prompt de entreno.
interface PRStat {
  kg: number;
  fecha?: string;
}

// Stats del registro de pesos · las funciones solo leen los PRs (para que
// la IA proponga cargas por encima de lo ya levantado). Optional · un user
// recién registrado no tiene historial todavía.
interface RegistroStats {
  prs?: Record<string, PRStat>;
}

// Config del batido que las funciones leen como REFERENCIA (ajustable) para
// que la IA cuadre las macros del día y, si lo ve, proponga otras. No son
// valores fijos · vienen del doc del user (default de la app para uno nuevo).
interface SuplementosDoc {
  batidoConfig?: {
    gr_prot?: number;
    kcal?: number;
    prot?: number;
    carb?: number;
    fat?: number;
  };
}

// UserDocument · solo los campos que las funciones leen/escriben.
export interface UserDocument {
  profile: UserProfile;
  menu: Menu;
  entrenos: Entrenos;
  compra: Compra;
  suplementos?: SuplementosDoc;
  plan: PlanIA;
  generaciones: GeneracionesIA;
  // Historial de PRs · lo lee el prompt de entreno (progresiones realistas).
  registroStats?: RegistroStats;
  isDemo?: boolean;
}
