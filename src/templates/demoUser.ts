// ────────────────────────────────────────────────────────────────────────────
// demoUser · datos de ejemplo para el modo prueba (sesión anónima)
//
// Mismo schema que `defaultUser` pero con un plan completo: menú semanal
// realista, plan de entreno 4 días Push/Pull/Legs, lista de compra y
// contadores de suplementación.
//
// Estos datos solo se siembran cuando alguien pulsa "Probar sin cuenta"
// en la Landing. Nunca se cargan para usuarios reales — para ellos la
// estructura arranca vacía con `defaultUser` y se rellena por IA o manual.
// ────────────────────────────────────────────────────────────────────────────

import type {
  Comida,
  ComidaExtra,
  Compra,
  DayKey,
  EjercicioRegistrado,
  Entrenos,
  ExerciseHistoryEntry,
  ItemCompra,
  Menu,
  MealKey,
  PlanEntreno,
  PRStat,
  RegistroDia,
  RegistroStats,
  SupHistoryEntry,
  Suplementos,
  UserDocument,
  UserProfile,
} from './defaultUser';
import {
  DAY_KEYS,
  DEFAULT_COMPRA_CATEGORIAS,
  HORA_DEFECTO,
  defaultGeneraciones,
  defaultMenuFlags,
  defaultPlan,
  defaultUserDocument,
} from './defaultUser';

// ── Helpers internos ──────────────────────────────────────────────────────

// Helper · `alimentos` viene como tuplas [nombre, cantidad] para que la
// definición sea más compacta y legible. Cantidad vacía '' = sin cantidad
// específica (ej. ensaladas, verduras).
function comida(
  meal: MealKey,
  alimentos: ReadonlyArray<readonly [string, string]>,
  kcal: number,
  prot: number,
  carb: number,
  fat: number,
  nombrePlato?: string,
): Comida {
  return {
    alimentos: alimentos.map(([nombre, cantidad]) => ({ nombre, cantidad })),
    hora: HORA_DEFECTO[meal],
    kcal,
    prot,
    carb,
    fat,
    // El plan de demo se considera "default" — la IA puede sobrescribirlo
    // si el invitado se registra como user real y pulsa Generar con IA.
    source: 'default',
    // Nombre del plato · solo en algunos demos para que el invitado vea
    // un ejemplo. Al pasar por la card se muestra como única descripción.
    nombrePlato: nombrePlato ?? null,
  };
}

// ── Menú semanal ──────────────────────────────────────────────────────────
// Objetivo aproximado: ~2.000 kcal · ~150 g prot · ~210 g carb · ~60 g fat.
// Volumen ligero para alguien de ~75 kg que entrena 4 días.

// Definimos el menú en un literal sin `extras` (DiaSinExtras) y luego
// envolvemos cada día con `extras: []` para construir el Menu final · así
// no hay que repetir `extras: []` en los 7 días del literal.
type DiaSinExtras = Omit<import('./defaultUser').ComidasDelDia, 'extras'>;
const DEMO_DAYS: Record<DayKey, DiaSinExtras> = {
  lun: {
    desayuno: comida('desayuno', [
      ['Avena', '60 g'],
      ['Leche desnatada', '250 ml'],
      ['Plátano mediano', '1'],
      ['Claras de huevo', '4'],
    ], 520, 30, 75, 10, 'Bowl de avena con plátano'),
    comida: comida('comida', [
      ['Pechuga de pollo', '180 g'],
      ['Arroz integral', '80 g'],
      ['Brócoli al vapor', ''],
    ], 620, 55, 70, 9, 'Pollo con arroz y brócoli'),
    merienda: comida('merienda', [
      ['Yogur griego', '200 g'],
      ['Frutos secos', '20 g'],
      ['Miel', '1 cdta'],
    ], 320, 22, 25, 14, 'Yogur con frutos secos'),
    cena: comida('cena', [
      ['Salmón', '200 g'],
      ['Boniato asado', '200 g'],
      ['Ensalada mixta', ''],
    ], 580, 42, 50, 22, 'Salmón al horno con boniato'),
  },
  mar: {
    desayuno: comida('desayuno', [
      ['Tortilla francesa', '3 huevos'],
      ['Tostada integral', '1'],
      ['Tomate', ''],
    ], 480, 26, 40, 22, 'Tortilla con tostada y tomate'),
    comida: comida('comida', [
      ['Ternera magra', '150 g'],
      ['Pasta integral', '80 g'],
      ['Tomate natural', ''],
    ], 650, 52, 75, 14, 'Pasta integral con ternera'),
    merienda: comida('merienda', [
      ['Skyr', '200 g'],
      ['Arándanos', '100 g'],
      ['Almendras', '15 g'],
    ], 290, 26, 22, 12, 'Skyr con arándanos y almendras'),
    cena: comida('cena', [
      ['Pavo a la plancha', '200 g'],
      ['Quinoa', '70 g'],
      ['Verduras al horno', ''],
    ], 560, 44, 55, 16, 'Pavo con quinoa y verduras'),
  },
  mie: {
    desayuno: comida('desayuno', [
      ['Tortitas de avena', '50 g'],
      ['Claras', '4'],
      ['Plátano', '1'],
      ['Miel', '1 cdta'],
    ], 510, 28, 68, 12, 'Tortitas de avena con plátano'),
    comida: comida('comida', [
      ['Salmón', '180 g'],
      ['Patata cocida', '200 g'],
      ['Espinacas salteadas', ''],
    ], 620, 40, 55, 26, 'Salmón con patata y espinacas'),
    merienda: comida('merienda', [
      ['Queso fresco batido', '200 g'],
      ['Manzana', '1'],
      ['Crema de cacahuete', '15 g'],
    ], 310, 24, 28, 12, 'Queso batido con manzana'),
    cena: comida('cena', [
      ['Pollo al curry', '180 g'],
      ['Arroz basmati', '80 g'],
      ['Pimientos asados', ''],
    ], 590, 48, 60, 14, 'Pollo al curry con arroz basmati'),
  },
  jue: {
    desayuno: comida('desayuno', [
      ['Avena', '60 g'],
      ['Leche desnatada', '250 ml'],
      ['Frutos rojos', '100 g'],
      ['Claras', '4'],
    ], 500, 30, 72, 8, 'Bowl de avena con frutos rojos'),
    comida: comida('comida', [
      ['Pechuga de pollo', '180 g'],
      ['Boniato', '200 g'],
      ['Brócoli', ''],
    ], 620, 52, 68, 12, 'Pollo con boniato y brócoli'),
    merienda: comida('merienda', [
      ['Yogur griego', '200 g'],
      ['Nueces', '20 g'],
      ['Miel', '1 cdta'],
    ], 320, 22, 25, 14, 'Yogur griego con nueces'),
    cena: comida('cena', [
      ['Atún fresco', '180 g'],
      ['Arroz integral', '80 g'],
      ['Aguacate', '1/2'],
    ], 600, 45, 55, 22, 'Atún con arroz y aguacate'),
  },
  vie: {
    desayuno: comida('desayuno', [
      ['Bowl de avena', '60 g'],
      ['Plátano', '1'],
      ['Cacao puro', '1 cdta'],
      ['Claras', '2'],
    ], 510, 28, 72, 12, 'Bowl de avena con cacao'),
    comida: comida('comida', [
      ['Lentejas (peso seco)', '100 g'],
      ['Verduras', ''],
      ['Arroz blanco', '60 g'],
    ], 600, 35, 85, 8, 'Lentejas con arroz y verduras'),
    merienda: comida('merienda', [
      ['Yogur griego', '200 g'],
      ['Frutos secos', '20 g'],
      ['Miel', '1 cdta'],
    ], 320, 22, 25, 14, 'Yogur griego con frutos secos'),
    cena: comida('cena', [
      ['Salmón', '180 g'],
      ['Quinoa', '70 g'],
      ['Espárragos a la plancha', ''],
    ], 590, 40, 52, 22, 'Salmón con quinoa y espárragos'),
  },
  sab: {
    desayuno: comida('desayuno', [
      ['Tostadas integrales', ''],
      ['Aguacate', '1/2'],
      ['Huevos a la plancha', '2'],
      ['Tomate', ''],
    ], 540, 26, 45, 26, 'Tostadas con aguacate y huevo'),
    comida: comida('comida', [
      ['Ternera magra', '150 g'],
      ['Pasta integral', '80 g'],
      ['Tomate natural', ''],
    ], 670, 55, 76, 14, 'Pasta integral con ternera'),
    merienda: comida('merienda', [
      ['Skyr', '200 g'],
      ['Manzana', '1'],
      ['Crema de cacahuete', '15 g'],
    ], 320, 22, 30, 12, 'Skyr con manzana y cacahuete'),
    cena: comida('cena', [
      ['Pavo a la plancha', '200 g'],
      ['Boniato asado', '200 g'],
      ['Espinacas', ''],
    ], 560, 45, 56, 16, 'Pavo con boniato y espinacas'),
  },
  dom: {
    desayuno: comida('desayuno', [
      ['Tortitas de avena', '50 g'],
      ['Plátano', '1'],
      ['Miel', '1 cdta'],
      ['Claras', '4'],
    ], 510, 28, 68, 12, 'Tortitas de avena con miel'),
    comida: comida('comida', [
      ['Pollo al horno', '180 g'],
      ['Arroz integral', '80 g'],
      ['Brócoli', ''],
    ], 600, 52, 68, 10, 'Pollo al horno con arroz'),
    merienda: comida('merienda', [
      ['Yogur griego', '200 g'],
      ['Arándanos', '100 g'],
      ['Almendras', '15 g'],
    ], 320, 24, 22, 14, 'Yogur con arándanos y almendras'),
    cena: comida('cena', [
      ['Salmón', '200 g'],
      ['Patata cocida', '200 g'],
      ['Espárragos', ''],
    ], 580, 42, 50, 24, 'Salmón con patata y espárragos'),
  },
};

// Construye el Menu final con `extras` en varios días · pre-entreno, snack
// media-mañana, aperitivo de fin de semana · para que el invitado vea la
// feature "extras" demostrada en distintos momentos del día y con
// distintos shape de uso (pequeño snack, refuerzo proteico, social).
const _EXTRAS_BY_DAY: Partial<Record<DayKey, ComidaExtra[]>> = {
  lun: [
    {
      id: 'demo-pre-entreno-lun',
      nombre: 'Pre-entreno',
      nombrePlato: 'Plátano y café solo',
      alimentos: [
        { nombre: 'Plátano', cantidad: '1' },
        { nombre: 'Café solo', cantidad: '1' },
      ],
      hora: '17:00',
      kcal: 110,
      prot: 1,
      carb: 27,
      fat: 0,
      source: 'default',
    },
  ],
  mar: [
    {
      id: 'demo-media-manana-mar',
      nombre: 'Media mañana',
      nombrePlato: 'Manzana + barrita de proteína',
      alimentos: [
        { nombre: 'Manzana', cantidad: '1' },
        { nombre: 'Barrita de proteína', cantidad: '1' },
      ],
      hora: '11:00',
      kcal: 240,
      prot: 18,
      carb: 28,
      fat: 6,
      source: 'default',
    },
  ],
  jue: [
    {
      id: 'demo-pre-entreno-jue',
      nombre: 'Pre-entreno',
      nombrePlato: 'Café + tostada de pavo',
      alimentos: [
        { nombre: 'Café solo', cantidad: '1' },
        { nombre: 'Tostada integral', cantidad: '1' },
        { nombre: 'Pavo en lonchas', cantidad: '50 g' },
      ],
      hora: '17:00',
      kcal: 180,
      prot: 14,
      carb: 22,
      fat: 3,
      source: 'default',
    },
  ],
  sab: [
    {
      id: 'demo-aperitivo-sab',
      nombre: 'Aperitivo',
      nombrePlato: 'Picoteo casero',
      alimentos: [
        { nombre: 'Hummus', cantidad: '60 g' },
        { nombre: 'Crudités (zanahoria, pepino)', cantidad: '' },
        { nombre: 'Aceitunas', cantidad: '20 g' },
      ],
      hora: '13:00',
      kcal: 220,
      prot: 8,
      carb: 18,
      fat: 14,
      source: 'default',
    },
  ],
};

const DEMO_MENU: Menu = Object.fromEntries(
  DAY_KEYS.map((day) => [
    day,
    {
      ...DEMO_DAYS[day],
      extras: _EXTRAS_BY_DAY[day] ?? [],
    },
  ]),
) as Menu;

// ── Plan de entreno · 4 días Push/Pull/Legs/Brazos ────────────────────────

// Demo entrenos · 7 builtIn (1..7 días) + un plan custom adicional
// marcado como predeterminado (Sub-fase 2D.1). El plan custom es
// una variante 4 días Push/Pull/Legs/Hombro asignada a Lun/Mar/Jue/Vie
// · cubre los días típicos de gym y muestra al invitado la feature
// "Marcar como predeterminado" desde el primer login.
const DEMO_PLAN_CUSTOM_PRED: PlanEntreno = {
  id: 'plan_demo_custom_pred',
  nombre: 'Mi rutina semanal',
  estructura: '',
  estructura2: '',
  builtIn: false,
  esPredeterminado: true,
  dias: [
    {
      titulo: 'Día A · Empuje',
      descripcion: 'Pecho · Tríceps · Hombros',
      tiempoEstimadoMin: 70,
      diaSemana: 'lun',
      badge: 'pecho',
      badgeCustom: '',
      badge2: 'triceps',
      badgeCustom2: '',
      badge3: 'empuje',
      badgeCustom3: '',
      ejercicios: [
        { nombre: 'Press banca con barra', desc: '', series: '4×6-8', source: 'default' },
        { nombre: 'Press inclinado mancuernas', desc: '', series: '3×8-10', source: 'default' },
        { nombre: 'Aperturas en polea', desc: '', series: '3×12', source: 'default' },
        { nombre: 'Press francés barra Z', desc: '', series: '3×10', source: 'default' },
        { nombre: 'Extensiones tríceps polea', desc: '', series: '3×12', source: 'default' },
      ],
      comentario: 'Calentar bien el pecho con 2 series ligeras antes de la primera pesada del press banca.',
      source: 'default',
    },
    {
      titulo: 'Día B · Tirón',
      descripcion: 'Espalda · Bíceps',
      tiempoEstimadoMin: 65,
      diaSemana: 'mar',
      badge: 'espalda',
      badgeCustom: '',
      badge2: 'biceps',
      badgeCustom2: '',
      badge3: '',
      badgeCustom3: 'Fuerza',
      ejercicios: [
        { nombre: 'Dominadas', desc: 'Lastradas si puedes', series: '4×6-8', source: 'default' },
        { nombre: 'Remo con barra', desc: '', series: '4×8', source: 'default' },
        { nombre: 'Jalón al pecho', desc: '', series: '3×10', source: 'default' },
        { nombre: 'Curl con barra Z', desc: '', series: '3×10', source: 'default' },
        { nombre: 'Curl martillo', desc: 'Alternando', series: '3×12', source: 'default' },
      ],
      comentario: 'Si las dominadas se hacen demasiado fáciles, añadir lastre o pasar a 5×6 con peso.',
      source: 'default',
    },
    {
      titulo: 'Día C · Pierna',
      descripcion: 'Tren inferior',
      tiempoEstimadoMin: 80,
      diaSemana: 'jue',
      badge: 'piernas',
      badgeCustom: '',
      badge2: 'fuerza',
      badgeCustom2: '',
      badge3: '',
      badgeCustom3: '',
      ejercicios: [
        { nombre: 'Sentadilla con barra', desc: 'Bajo paralelo', series: '4×6-8', source: 'default' },
        { nombre: 'Peso muerto rumano', desc: '', series: '4×8', source: 'default' },
        { nombre: 'Prensa 45°', desc: '', series: '3×10', source: 'default' },
        { nombre: 'Curl femoral', desc: '', series: '3×12', source: 'default' },
        { nombre: 'Gemelos de pie', desc: 'Pausa arriba', series: '4×15', source: 'default' },
      ],
      comentario: 'Día pesado · descansar 3 min entre series principales y cuidar la técnica en sentadilla.',
      source: 'default',
    },
    {
      titulo: 'Día D · Hombro + Core',
      descripcion: 'Hombros · Core',
      tiempoEstimadoMin: 55,
      diaSemana: 'vie',
      badge: 'hombros',
      badgeCustom: '',
      badge2: 'core',
      badgeCustom2: '',
      badge3: '',
      badgeCustom3: 'Cardio final',
      ejercicios: [
        { nombre: 'Press militar con barra', desc: 'De pie', series: '4×6-8', source: 'default' },
        { nombre: 'Elevaciones laterales', desc: 'Mancuernas', series: '4×12', source: 'default' },
        { nombre: 'Pájaro / Reverse fly', desc: '', series: '3×12', source: 'default' },
        { nombre: 'Plancha frontal', desc: '60s', series: '3×60s', source: 'default' },
      ],
      comentario: 'Acabar con 10-15 min de cinta a ritmo cómodo si queda energía · no es obligatorio.',
      source: 'default',
    },
  ],
};

const _BUILTIN_ENTRENOS = defaultUserDocument().entrenos;
const DEMO_ENTRENOS: Entrenos = {
  // Plan activo · el custom predeterminado del user · feature destacada
  // (sustituye al recommendedId basado en `profile.diasEntreno`).
  activePlan: DEMO_PLAN_CUSTOM_PRED.id,
  planes: {
    ..._BUILTIN_ENTRENOS.planes,
    [DEMO_PLAN_CUSTOM_PRED.id]: DEMO_PLAN_CUSTOM_PRED,
  },
};

// ── Lista de la compra (los 12 productos del v2) ──────────────────────────

// IDs deterministas para items demo · si fueran timestamp+random, cada
// vez que se monta el invitado tendría ids distintos en Firestore (lo
// que rompería los toggles de "comprado" si abre la app desde 2 sitios).
// Con este patrón "demo_<categoria>_<n>" el doc del invitado mantiene
// los mismos ids entre sesiones.
const itemBought = (
  catId: string,
  n: number,
  nombre: string,
  cantidad: string,
  precio: number,
): ItemCompra => ({
  id: `demo_${catId}_${n}`,
  nombre,
  cantidad,
  comprado: true,
  precio,
  source: 'default',
});

const itemPending = (
  catId: string,
  n: number,
  nombre: string,
  cantidad: string,
  precio: number,
): ItemCompra => ({
  id: `demo_${catId}_${n}`,
  nombre,
  cantidad,
  comprado: false,
  precio,
  source: 'default',
});

const DEMO_COMPRA: Compra = {
  // Reusamos las 7 categorías builtIn por defecto.
  categorias: DEFAULT_COMPRA_CATEGORIAS.map((c) => ({ ...c })),
  items: {
    proteinas: [
      itemBought('proteinas', 1, 'Pechuga de pollo', '1 kg', 8.4),
      itemPending('proteinas', 2, 'Salmón fresco', '500 g', 12.9),
      itemPending('proteinas', 3, 'Huevos', '1 docena', 3.2),
      itemPending('proteinas', 4, 'Ternera magra picada', '500 g', 7.5),
    ],
    lacteos: [
      itemBought('lacteos', 1, 'Yogur griego', 'Pack 4 ud', 3.5),
      itemPending('lacteos', 2, 'Leche desnatada', '1 L', 1.1),
      itemPending('lacteos', 3, 'Skyr natural', '450 g', 2.8),
      itemBought('lacteos', 4, 'Queso fresco batido 0%', '500 g', 1.9),
    ],
    hidratos: [
      itemBought('hidratos', 1, 'Arroz integral', '1 kg', 2.4),
      itemBought('hidratos', 2, 'Avena en copos', '500 g', 1.8),
      itemPending('hidratos', 3, 'Pasta integral', '500 g', 1.5),
      itemPending('hidratos', 4, 'Pan integral', '1 ud', 1.3),
      itemPending('hidratos', 5, 'Quinoa', '500 g', 4.5),
    ],
    frutas_verduras: [
      itemBought('frutas_verduras', 1, 'Plátanos', '1 kg', 1.2),
      itemBought('frutas_verduras', 2, 'Manzanas', '1 kg', 1.8),
      itemPending('frutas_verduras', 3, 'Brócoli', '1 ud', 2.0),
      itemPending('frutas_verduras', 4, 'Espinacas', '500 g', 1.5),
      itemPending('frutas_verduras', 5, 'Tomates', '1 kg', 2.2),
    ],
    despensa: [
      itemBought('despensa', 1, 'Aceite de oliva virgen extra', '1 L', 7.9),
      itemBought('despensa', 2, 'Sal', '1 kg', 0.5),
      itemBought('despensa', 3, 'Pimienta negra', '50 g', 1.8),
      itemPending('despensa', 4, 'Vinagre balsámico', '500 ml', 2.5),
      itemPending('despensa', 5, 'Especias variadas (orégano, comino...)', '', 4.0),
    ],
    grasas: [
      itemBought('grasas', 1, 'Aguacates', 'Pack 4 ud', 3.5),
      itemPending('grasas', 2, 'Crema de cacahuete 100%', '350 g', 4.8),
      itemPending('grasas', 3, 'Frutos secos surtidos', '250 g', 5.2),
    ],
    suplementacion: [
      itemBought('suplementacion', 1, 'Whey protein', '750 g', 14.9),
      itemBought('suplementacion', 2, 'Creatina monohidrato', '300 g', 9.9),
    ],
  },
};

// ── Suplementos · contadores de dosis restantes ───────────────────────────

// El demo invitado · Sub-fase 2B.5.b. Para ver el bloque de
// suplementación funcional al instante: el invitado ya ha "tomado"
// 3 batidos y 8 dosis de creatina; los contadores semanal/mensual de
// creatina vienen pre-arrancados con 2 / 8 (esta semana / este mes).
//
// ⚠ Los `*_inicio` deben caer DENTRO del periodo actual (ISO week /
// mes / año) · si caen fuera, `maybeResetSupCounters` detecta el
// cambio en el primer load del invitado y dispara un `patchSuplementos`
// adicional (round-trip a Firestore extra que se nota como lentitud
// al entrar como invitado). Por eso seteamos los inicios al lunes
// 00:00 de esta semana, día 1 del mes actual, y 1 enero del año
// actual · garantiza que NO hay reset automático tras seed.
const _NOW_DEMO = new Date();
const _DAY_OF_WEEK = _NOW_DEMO.getDay() || 7; // 1=lunes ... 7=domingo (ISO)
const DEMO_SEMANA_INICIO = new Date(
  _NOW_DEMO.getFullYear(),
  _NOW_DEMO.getMonth(),
  _NOW_DEMO.getDate() - (_DAY_OF_WEEK - 1),
).getTime();
const DEMO_MES_INICIO = new Date(_NOW_DEMO.getFullYear(), _NOW_DEMO.getMonth(), 1).getTime();
const DEMO_ANIO_INICIO = new Date(_NOW_DEMO.getFullYear(), 0, 1).getTime();

// Helper · genera entries de history para los días `offsets` (días
// hacia atrás desde hoy). Útil para poblar batidoHistory/creatinaHistory
// con datos realistas que pueblen los gráficos de la tab Suplementación.
function _historyEntries(offsets: number[]): SupHistoryEntry[] {
  const out: SupHistoryEntry[] = [];
  for (const offset of offsets) {
    const dt = new Date(
      _NOW_DEMO.getFullYear(),
      _NOW_DEMO.getMonth(),
      _NOW_DEMO.getDate() - offset,
    );
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    out.push({ fecha: `${yyyy}-${mm}-${dd}`, count: 1 });
  }
  return out;
}

// Pattern realista · batido los días que toca gym (según
// `daysWithBatido`) + algunos días extras. 8 entries en últimos 14
// días → un user típico que toma batido ~4 veces por semana.
const _DEMO_BATIDO_HISTORY = _historyEntries([1, 3, 4, 6, 8, 10, 11, 13]);
// Creatina más frecuente · cada día casi (12 entries en 14 días).
const _DEMO_CREATINA_HISTORY = _historyEntries([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13,
]);

const DEMO_SUPLEMENTOS: Suplementos = {
  // Stock en gramos · igual que el v1. Bote típico de whey 750g con dosis
  // de 35g → 21 batidos posibles. Bote de creatina 300g con 3g/dosis →
  // 100 dosis posibles. Tomados ajustados a la longitud del history:
  // 8 batidos y 12 creatinas en los últimos 14 días.
  batido_stock_gramos: 750,
  creatina_stock_gramos: 300,
  batidos_tomados_total: _DEMO_BATIDO_HISTORY.length,
  creatinas_tomadas_total: _DEMO_CREATINA_HISTORY.length,
  // Counters semanal/mensual/anual precargados · para que el invitado
  // vea las cuatro métricas (semana / mes / año / total) al entrar.
  // "Esta semana" cuenta solo entries con offset < 7.
  batidos_tomados_semana: _DEMO_BATIDO_HISTORY.filter((e) => {
    const ageDays = (Date.now() - new Date(e.fecha).getTime()) / 86400000;
    return ageDays < 7;
  }).length,
  batidos_tomados_mes: _DEMO_BATIDO_HISTORY.length,
  batidos_tomados_anio: _DEMO_BATIDO_HISTORY.length,
  creatinas_tomadas_semana: _DEMO_CREATINA_HISTORY.filter((e) => {
    const ageDays = (Date.now() - new Date(e.fecha).getTime()) / 86400000;
    return ageDays < 7;
  }).length,
  creatinas_tomadas_mes: _DEMO_CREATINA_HISTORY.length,
  creatinas_tomadas_anio: _DEMO_CREATINA_HISTORY.length,
  batido_semana_inicio: DEMO_SEMANA_INICIO,
  batido_mes_inicio: DEMO_MES_INICIO,
  batido_anio_inicio: DEMO_ANIO_INICIO,
  creatina_semana_inicio: DEMO_SEMANA_INICIO,
  creatina_mes_inicio: DEMO_MES_INICIO,
  creatina_anio_inicio: DEMO_ANIO_INICIO,
  // El demo arranca sin nada marcado para hoy · el invitado verá los
  // botones "Marcar tomado hoy" en HoyPage y podrá probar el flujo.
  last_batido_date: null,
  last_creatina_date: null,
  batidoConfig: {
    gr_prot: 35,
    includeCreatina: true,
    extras: '300 ml leche semi + 1 plátano',
    kcal: 285,
    prot: 38,
    carb: 35,
    fat: 4,
    producto_nombre: 'Whey Iso 100',
    producto_precio: 29.95,
  },
  creatinaConfig: {
    gr_dose: 3,
    notas: 'Antes del entreno, con agua',
    producto_nombre: 'Creatina Monohidrato',
    producto_precio: 14.5,
  },
  // El demo arranca con batido en lun/mar/jue (días de gym) y creatina
  // los mismos días + sábado · enseña la mecánica al user en seguida.
  daysWithBatido: ['lun', 'mar', 'jue'],
  daysWithCreatina: ['lun', 'mar', 'jue', 'sab'],
  // Ejemplo de override per-día · el lunes el batido es post-entreno
  // a las 19:30, el resto de días usan la hora default.
  batidoOverrides: {
    lun: { hora: '19:30', titulo: 'Batido post-entreno' },
  },
  // Sábado la creatina se toma por la mañana (no es día de gym pero
  // mantiene la saturación) · muestra al user el feature de override
  // también para creatina, no solo para batido.
  creatinaOverrides: {
    sab: { hora: '10:30', titulo: 'Creatina con desayuno' },
  },
  // Histórico fechado de tomas (Sub-fase 2E.1) · poblado para que el
  // invitado vea los gráficos de la tab Suplementación con datos
  // reales desde el primer login (8 batidos y 12 creatinas en los
  // últimos 14 días). El total/semana/mes/año coincide con la
  // longitud del array · sin desincronización entre HoyPage y Gráficos.
  batidoHistory: _DEMO_BATIDO_HISTORY,
  creatinaHistory: _DEMO_CREATINA_HISTORY,
};

// ── Profile del invitado · perfil tipo "ya completado" ────────────────────

const DEMO_PROFILE: UserProfile = {
  nombre: 'Invitado',
  edad: 28,
  peso: 75,
  altura: 178,
  sexo: 'm',
  actividad: 'moderado',
  diasEntreno: 4,
  equipamiento: 'gimnasio',
  objetivo: 'volumen',
  restricciones: [],
  // Poblamos los campos editables del paso 4 del onboarding con ejemplos
  // realistas · para que el invitado vea en EditFitnessProfileModal cómo
  // se renderizan los chips de intolerancias/alergias/alimentos en lugar
  // de campos vacíos que no descubren la feature.
  notas: 'Entreno en gimnasio por la tarde. Como fuera del trabajo 1-2 veces por semana · prefiero opciones ligeras.',
  intolerancias: ['cebolla cruda'],
  alergias: ['mariscos'],
  alimentosProhibidos: ['bebidas azucaradas', 'bollería industrial'],
  alimentosObligatorios: ['1 fruta al día', 'verdura en la cena'],
  ingredientesFavoritos: ['aguacate', 'salmón', 'avena', 'pollo a la plancha'],
  objetivoKcal: 2200, // calculado: hombre 28a · 75kg · 178cm · moderado · volumen
  modo: 'manual', // el invitado no puede usar IA por diseño
  aiScope: null,
  completed: true,
};

// ── Registro de pesos · datos demo (Sub-fase 2E + 2E.1) ──────────────────
//
// El invitado verá:
//   - 4 entries en /users/{uid}/registros/{fecha} de los últimos 6 días
//     (Lun/Mar/Jue/Vie con plan + dos descansos · pattern realista).
//   - registroStats poblado con 3 PRs y exerciseHistory para sparklines.
//
// Las fechas son relativas a `_NOW_DEMO` · siempre frescas respecto al
// "hoy" del invitado al crear la cuenta. Si el invitado crea la cuenta
// y vuelve días después, los registros se mantienen con sus fechas
// originales (es lo correcto · representan el pasado).

// Helper · ofset → fecha 'YYYY-MM-DD' (días hacia atrás desde NOW).
function _offsetToFecha(offset: number): string {
  const dt = new Date(
    _NOW_DEMO.getFullYear(),
    _NOW_DEMO.getMonth(),
    _NOW_DEMO.getDate() - offset,
  );
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Genera un EjercicioRegistrado con N series, todas con el mismo kg.
function _ej(kg: string, sets: number): EjercicioRegistrado {
  return { sets: Array.from({ length: sets }, () => ({ kg, reps: '' })) };
}

// Histórico de ejercicios para sparklines · cada array son los últimos
// puntos del ejercicio (max 10 según MAX_EXERCISE_HISTORY). Los
// progresos van subiendo poco a poco · típica curva de fuerza.
//
// Cubre TODOS los ejercicios del plan custom predeterminado (excepto
// Plancha que es tiempo, no peso) · así el RegDayPanel y el GraphsModal
// muestran sparkline + PR para cada ejercicio que el invitado abra,
// no solo 3 cargados a mano. El usuario ve la app "viva" desde el
// primer minuto.
//
// Pattern · 8 puntos por ejercicio cubriendo las últimas ~8 semanas
// (1 sesión semanal por ejercicio). Progresión 3-5% por sesión típica
// curva de fuerza. Ejercicios con peso corporal (Dominadas) llevan
// formato '+10' = corporal + 10 kg.
//
// El último punto coincide con el día que aparece en generateDemoRegistros
// (sesiones recientes) · así PR + history quedan consistentes con los
// registros del calendario y el RegDayPanel.
const _DEMO_EXERCISE_HISTORY: Record<string, ExerciseHistoryEntry[]> = {
  // Día A · Empuje · sesiones offset 6, 13, 20, 27, 34, 41, 48, 55
  'press banca con barra': [
    { fecha: _offsetToFecha(55), maxKg: 70 },
    { fecha: _offsetToFecha(48), maxKg: 72.5 },
    { fecha: _offsetToFecha(41), maxKg: 75 },
    { fecha: _offsetToFecha(34), maxKg: 80 },
    { fecha: _offsetToFecha(27), maxKg: 82.5 },
    { fecha: _offsetToFecha(20), maxKg: 85 },
    { fecha: _offsetToFecha(13), maxKg: 90 },
    { fecha: _offsetToFecha(6), maxKg: 92.5 },
  ],
  'press inclinado mancuernas': [
    { fecha: _offsetToFecha(55), maxKg: 22 },
    { fecha: _offsetToFecha(48), maxKg: 24 },
    { fecha: _offsetToFecha(41), maxKg: 26 },
    { fecha: _offsetToFecha(34), maxKg: 28 },
    { fecha: _offsetToFecha(27), maxKg: 28 },
    { fecha: _offsetToFecha(20), maxKg: 30 },
    { fecha: _offsetToFecha(13), maxKg: 30 },
    { fecha: _offsetToFecha(6), maxKg: 32 },
  ],
  'aperturas en polea': [
    { fecha: _offsetToFecha(55), maxKg: 10 },
    { fecha: _offsetToFecha(48), maxKg: 12 },
    { fecha: _offsetToFecha(41), maxKg: 12 },
    { fecha: _offsetToFecha(34), maxKg: 14 },
    { fecha: _offsetToFecha(27), maxKg: 14 },
    { fecha: _offsetToFecha(20), maxKg: 16 },
    { fecha: _offsetToFecha(13), maxKg: 16 },
    { fecha: _offsetToFecha(6), maxKg: 18 },
  ],
  'press francés barra z': [
    { fecha: _offsetToFecha(55), maxKg: 15 },
    { fecha: _offsetToFecha(48), maxKg: 17.5 },
    { fecha: _offsetToFecha(41), maxKg: 17.5 },
    { fecha: _offsetToFecha(34), maxKg: 20 },
    { fecha: _offsetToFecha(27), maxKg: 20 },
    { fecha: _offsetToFecha(20), maxKg: 22.5 },
    { fecha: _offsetToFecha(13), maxKg: 22.5 },
    { fecha: _offsetToFecha(6), maxKg: 25 },
  ],
  'extensiones tríceps polea': [
    { fecha: _offsetToFecha(55), maxKg: 14 },
    { fecha: _offsetToFecha(48), maxKg: 16 },
    { fecha: _offsetToFecha(41), maxKg: 16 },
    { fecha: _offsetToFecha(34), maxKg: 18 },
    { fecha: _offsetToFecha(27), maxKg: 18 },
    { fecha: _offsetToFecha(20), maxKg: 20 },
    { fecha: _offsetToFecha(13), maxKg: 20 },
    { fecha: _offsetToFecha(6), maxKg: 22 },
  ],
  // Día B · Tirón · sesiones offset 5, 12, 19, 26, 33, 40, 47, 54
  'dominadas': [
    { fecha: _offsetToFecha(54), maxKg: 0 },
    { fecha: _offsetToFecha(47), maxKg: 2.5 },
    { fecha: _offsetToFecha(40), maxKg: 2.5 },
    { fecha: _offsetToFecha(33), maxKg: 5 },
    { fecha: _offsetToFecha(26), maxKg: 5 },
    { fecha: _offsetToFecha(19), maxKg: 7.5 },
    { fecha: _offsetToFecha(12), maxKg: 7.5 },
    { fecha: _offsetToFecha(5), maxKg: 10 },
  ],
  'remo con barra': [
    { fecha: _offsetToFecha(54), maxKg: 50 },
    { fecha: _offsetToFecha(47), maxKg: 52.5 },
    { fecha: _offsetToFecha(40), maxKg: 55 },
    { fecha: _offsetToFecha(33), maxKg: 57.5 },
    { fecha: _offsetToFecha(26), maxKg: 60 },
    { fecha: _offsetToFecha(19), maxKg: 62.5 },
    { fecha: _offsetToFecha(12), maxKg: 65 },
    { fecha: _offsetToFecha(5), maxKg: 70 },
  ],
  'jalón al pecho': [
    { fecha: _offsetToFecha(54), maxKg: 40 },
    { fecha: _offsetToFecha(47), maxKg: 42.5 },
    { fecha: _offsetToFecha(40), maxKg: 45 },
    { fecha: _offsetToFecha(33), maxKg: 47.5 },
    { fecha: _offsetToFecha(26), maxKg: 50 },
    { fecha: _offsetToFecha(19), maxKg: 52.5 },
    { fecha: _offsetToFecha(12), maxKg: 55 },
    { fecha: _offsetToFecha(5), maxKg: 60 },
  ],
  'curl con barra z': [
    { fecha: _offsetToFecha(54), maxKg: 15 },
    { fecha: _offsetToFecha(47), maxKg: 15 },
    { fecha: _offsetToFecha(40), maxKg: 17.5 },
    { fecha: _offsetToFecha(33), maxKg: 17.5 },
    { fecha: _offsetToFecha(26), maxKg: 20 },
    { fecha: _offsetToFecha(19), maxKg: 20 },
    { fecha: _offsetToFecha(12), maxKg: 22.5 },
    { fecha: _offsetToFecha(5), maxKg: 25 },
  ],
  'curl martillo': [
    { fecha: _offsetToFecha(54), maxKg: 8 },
    { fecha: _offsetToFecha(47), maxKg: 8 },
    { fecha: _offsetToFecha(40), maxKg: 9 },
    { fecha: _offsetToFecha(33), maxKg: 10 },
    { fecha: _offsetToFecha(26), maxKg: 10 },
    { fecha: _offsetToFecha(19), maxKg: 12 },
    { fecha: _offsetToFecha(12), maxKg: 12 },
    { fecha: _offsetToFecha(5), maxKg: 14 },
  ],
  // Día C · Pierna · sesiones offset 4, 11, 18, 25, 32, 39, 46, 53
  'sentadilla con barra': [
    { fecha: _offsetToFecha(53), maxKg: 70 },
    { fecha: _offsetToFecha(46), maxKg: 75 },
    { fecha: _offsetToFecha(39), maxKg: 80 },
    { fecha: _offsetToFecha(32), maxKg: 85 },
    { fecha: _offsetToFecha(25), maxKg: 90 },
    { fecha: _offsetToFecha(18), maxKg: 95 },
    { fecha: _offsetToFecha(11), maxKg: 105 },
    { fecha: _offsetToFecha(4), maxKg: 110 },
  ],
  'peso muerto rumano': [
    { fecha: _offsetToFecha(53), maxKg: 60 },
    { fecha: _offsetToFecha(46), maxKg: 65 },
    { fecha: _offsetToFecha(39), maxKg: 70 },
    { fecha: _offsetToFecha(32), maxKg: 75 },
    { fecha: _offsetToFecha(25), maxKg: 75 },
    { fecha: _offsetToFecha(18), maxKg: 80 },
    { fecha: _offsetToFecha(11), maxKg: 90 },
    { fecha: _offsetToFecha(4), maxKg: 100 },
  ],
  'prensa 45°': [
    { fecha: _offsetToFecha(53), maxKg: 100 },
    { fecha: _offsetToFecha(46), maxKg: 110 },
    { fecha: _offsetToFecha(39), maxKg: 120 },
    { fecha: _offsetToFecha(32), maxKg: 130 },
    { fecha: _offsetToFecha(25), maxKg: 140 },
    { fecha: _offsetToFecha(18), maxKg: 150 },
    { fecha: _offsetToFecha(11), maxKg: 160 },
    { fecha: _offsetToFecha(4), maxKg: 180 },
  ],
  'curl femoral': [
    { fecha: _offsetToFecha(53), maxKg: 25 },
    { fecha: _offsetToFecha(46), maxKg: 27.5 },
    { fecha: _offsetToFecha(39), maxKg: 30 },
    { fecha: _offsetToFecha(32), maxKg: 32.5 },
    { fecha: _offsetToFecha(25), maxKg: 35 },
    { fecha: _offsetToFecha(18), maxKg: 37.5 },
    { fecha: _offsetToFecha(11), maxKg: 40 },
    { fecha: _offsetToFecha(4), maxKg: 45 },
  ],
  'gemelos de pie': [
    { fecha: _offsetToFecha(53), maxKg: 40 },
    { fecha: _offsetToFecha(46), maxKg: 45 },
    { fecha: _offsetToFecha(39), maxKg: 50 },
    { fecha: _offsetToFecha(32), maxKg: 55 },
    { fecha: _offsetToFecha(25), maxKg: 60 },
    { fecha: _offsetToFecha(18), maxKg: 65 },
    { fecha: _offsetToFecha(11), maxKg: 70 },
    { fecha: _offsetToFecha(4), maxKg: 80 },
  ],
  // Día D · Hombro + Core · sesiones offset 2, 9, 16, 23, 30, 37, 44, 51
  // (Plancha excluida · es tiempo, no peso)
  'press militar con barra': [
    { fecha: _offsetToFecha(51), maxKg: 35 },
    { fecha: _offsetToFecha(44), maxKg: 37.5 },
    { fecha: _offsetToFecha(37), maxKg: 40 },
    { fecha: _offsetToFecha(30), maxKg: 42.5 },
    { fecha: _offsetToFecha(23), maxKg: 45 },
    { fecha: _offsetToFecha(16), maxKg: 47.5 },
    { fecha: _offsetToFecha(9), maxKg: 50 },
    { fecha: _offsetToFecha(2), maxKg: 55 },
  ],
  'elevaciones laterales': [
    { fecha: _offsetToFecha(51), maxKg: 6 },
    { fecha: _offsetToFecha(44), maxKg: 6 },
    { fecha: _offsetToFecha(37), maxKg: 7 },
    { fecha: _offsetToFecha(30), maxKg: 7 },
    { fecha: _offsetToFecha(23), maxKg: 8 },
    { fecha: _offsetToFecha(16), maxKg: 8 },
    { fecha: _offsetToFecha(9), maxKg: 10 },
    { fecha: _offsetToFecha(2), maxKg: 12 },
  ],
  'pájaro / reverse fly': [
    { fecha: _offsetToFecha(51), maxKg: 5 },
    { fecha: _offsetToFecha(44), maxKg: 5 },
    { fecha: _offsetToFecha(37), maxKg: 6 },
    { fecha: _offsetToFecha(30), maxKg: 6 },
    { fecha: _offsetToFecha(23), maxKg: 7 },
    { fecha: _offsetToFecha(16), maxKg: 7 },
    { fecha: _offsetToFecha(9), maxKg: 8 },
    { fecha: _offsetToFecha(2), maxKg: 10 },
  ],
};

// PRs actuales · uno por ejercicio con récord. Coincide con el último
// punto de exerciseHistory para cada ejercicio.
const _DEMO_PRS: Record<string, PRStat> = {
  // Día A · Empuje
  'press banca con barra': { kg: 92.5, fecha: _offsetToFecha(6) },
  'press inclinado mancuernas': { kg: 32, fecha: _offsetToFecha(6) },
  'aperturas en polea': { kg: 18, fecha: _offsetToFecha(6) },
  'press francés barra z': { kg: 25, fecha: _offsetToFecha(6) },
  'extensiones tríceps polea': { kg: 22, fecha: _offsetToFecha(6) },
  // Día B · Tirón
  'dominadas': { kg: 10, fecha: _offsetToFecha(5) },
  'remo con barra': { kg: 70, fecha: _offsetToFecha(5) },
  'jalón al pecho': { kg: 60, fecha: _offsetToFecha(5) },
  'curl con barra z': { kg: 25, fecha: _offsetToFecha(5) },
  'curl martillo': { kg: 14, fecha: _offsetToFecha(5) },
  // Día C · Pierna
  'sentadilla con barra': { kg: 110, fecha: _offsetToFecha(4) },
  'peso muerto rumano': { kg: 100, fecha: _offsetToFecha(4) },
  'prensa 45°': { kg: 180, fecha: _offsetToFecha(4) },
  'curl femoral': { kg: 45, fecha: _offsetToFecha(4) },
  'gemelos de pie': { kg: 80, fecha: _offsetToFecha(4) },
  // Día D · Hombro
  'press militar con barra': { kg: 55, fecha: _offsetToFecha(2) },
  'elevaciones laterales': { kg: 12, fecha: _offsetToFecha(2) },
  'pájaro / reverse fly': { kg: 10, fecha: _offsetToFecha(2) },
};

const DEMO_REGISTRO_STATS: RegistroStats = {
  totalEntrenos: 32, // ~28 con plan + 4 descansos seleccionados de las últimas 8 semanas
  prs: _DEMO_PRS,
  exerciseHistory: _DEMO_EXERCISE_HISTORY,
};

// Genera los registros sembrables en `/users/{uid}/registros/{fecha}`.
// Pattern: 8 semanas hacia atrás con cadencia A→B→C→D semanal +
// descansos intercalados. Total ~32 registros = ~28 entrenos + ~4
// descansos · suficiente para que el calendario, los stats (racha,
// este mes, total entrenos, PRs totales) y las gráficas se vean
// densos y realistas desde el primer login.
//
// Cadencia base de cada semana (~7 días, indexed por offset · más
// cercano primero):
//   - Día A · Empuje · offsets 6, 13, 20, 27, 34, 41, 48, 55
//   - Día B · Tirón  · offsets 5, 12, 19, 26, 33, 40, 47, 54
//   - Día C · Pierna · offsets 4, 11, 18, 25, 32, 39, 46, 53
//   - Día D · Hombro · offsets 2,  9, 16, 23, 30, 37, 44, 51
//   - Descansos       · offsets 1,  3,  7,  8 (recientes para que la
//     racha visible sea continua) + intercalados algunos antiguos.
//
// Cada entreno reciente lleva kgs altos (PR-cercanos). Los antiguos
// progresivamente bajan · curva realista de fuerza. Pesos coherentes
// con `_DEMO_EXERCISE_HISTORY` para que sparkline + PR + registro
// abierto cuadren entre sí.
//
// Los nombres COINCIDEN exactamente con los de
// `DEMO_PLAN_CUSTOM_PRED.dias[N].ejercicios[*].nombre` (sensible a
// case · `normalizeExerciseName` lo iguala para PRs en stats).
//
// Llamada por `seedGuestDocument` en `db.ts` SOLO la primera vez que
// se siembra el doc del invitado (idempotente).
export function generateDemoRegistros(): RegistroDia[] {
  const now = Date.now();

  // Helpers · construyen el set de ejercicios de cada día con kg
  // variables (param para mostrar progresión semanal).
  const _diaA = (kgPress: string, kgIncl: string, kgAp: string, kgPf: string, kgExt: string) => ({
    'Press banca con barra': _ej(kgPress, 4),
    'Press inclinado mancuernas': _ej(kgIncl, 3),
    'Aperturas en polea': _ej(kgAp, 3),
    'Press francés barra Z': _ej(kgPf, 3),
    'Extensiones tríceps polea': _ej(kgExt, 3),
  });
  const _diaB = (kgDom: string, kgRemo: string, kgJalon: string, kgCurlZ: string, kgMart: string) => ({
    'Dominadas': _ej(kgDom, 4),
    'Remo con barra': _ej(kgRemo, 4),
    'Jalón al pecho': _ej(kgJalon, 3),
    'Curl con barra Z': _ej(kgCurlZ, 3),
    'Curl martillo': _ej(kgMart, 3),
  });
  const _diaC = (kgSent: string, kgPm: string, kgPrensa: string, kgFem: string, kgGem: string) => ({
    'Sentadilla con barra': _ej(kgSent, 4),
    'Peso muerto rumano': _ej(kgPm, 4),
    'Prensa 45°': _ej(kgPrensa, 3),
    'Curl femoral': _ej(kgFem, 3),
    'Gemelos de pie': _ej(kgGem, 4),
  });
  const _diaD = (kgMil: string, kgLat: string, kgPaj: string, secPla: string) => ({
    'Press militar con barra': _ej(kgMil, 4),
    'Elevaciones laterales': _ej(kgLat, 4),
    'Pájaro / Reverse fly': _ej(kgPaj, 3),
    'Plancha frontal': _ej(secPla, 3),
  });

  const samples: Array<{
    offset: number;
    plan: string;
    exercises: Record<string, EjercicioRegistrado>;
    notes: string;
  }> = [
    // ── Semana actual (offsets 1-7) · bloque de 6 entrenos seguidos
    //    (offset 1-6) que rompe en el descanso de offset 7 · da una
    //    racha actual = 6 en el demo para que se vea el StreakBadge
    //    "🔥 6 días" en HoyPage y la racha activa en la tab Rachas. ──
    { offset: 1, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+12,5', '72,5', '62,5', '27,5', '15'),
      notes: '6º día seguido entrenando · racha 🔥 a tope.' },
    { offset: 2, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('55', '12', '10', '60'),
      notes: '' },
    { offset: 3, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('95', '32,5', '18', '25', '22'),
      notes: 'Sin descanso esta semana · sensaciones buenas.' },
    { offset: 4, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('110', '100', '180', '45', '80'),
      notes: 'Doble PR · sentadilla y peso muerto rumano.' },
    { offset: 5, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+10', '70', '60', '25', '14'),
      notes: '' },
    { offset: 6, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('92,5', '32', '18', '25', '22'),
      notes: '¡PR en press banca! Buena energía hoy.' },
    { offset: 7, plan: 'rest', exercises: {}, notes: '' },
    // ── Semana -1 (offsets 8-14) ────────────────────────────────────
    { offset: 8, plan: 'rest', exercises: {}, notes: '' },
    { offset: 9, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('50', '10', '8', '55'),
      notes: '' },
    { offset: 11, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('105', '90', '160', '40', '70'),
      notes: 'Sentadilla 105×4 limpia, buena profundidad.' },
    { offset: 12, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+7,5', '65', '55', '22,5', '12'),
      notes: '' },
    { offset: 13, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('90', '30', '16', '22,5', '20'),
      notes: '' },
    // ── Semana -2 (offsets 15-21) ───────────────────────────────────
    { offset: 16, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('47,5', '8', '7', '50'),
      notes: '' },
    { offset: 18, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('95', '80', '150', '37,5', '65'),
      notes: '' },
    { offset: 19, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+7,5', '62,5', '52,5', '20', '12'),
      notes: '' },
    { offset: 20, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('85', '30', '16', '22,5', '20'),
      notes: '' },
    { offset: 21, plan: 'rest', exercises: {}, notes: 'Día de partido de pádel.' },
    // ── Semana -3 (offsets 22-28) ───────────────────────────────────
    { offset: 23, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('45', '8', '7', '50'),
      notes: '' },
    { offset: 25, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('90', '75', '140', '35', '60'),
      notes: '' },
    { offset: 26, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+5', '60', '50', '20', '10'),
      notes: '' },
    { offset: 27, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('82,5', '28', '14', '20', '18'),
      notes: '' },
    // ── Semana -4 (offsets 29-35) ───────────────────────────────────
    { offset: 30, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('42,5', '7', '6', '45'),
      notes: '' },
    { offset: 32, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('85', '75', '130', '32,5', '55'),
      notes: '' },
    { offset: 33, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+5', '57,5', '47,5', '17,5', '10'),
      notes: '' },
    { offset: 34, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('80', '28', '14', '20', '18'),
      notes: 'Comienzo de la fase de fuerza.' },
    // ── Semana -5 (offsets 36-42) ───────────────────────────────────
    { offset: 37, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('40', '7', '6', '45'),
      notes: '' },
    { offset: 39, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('80', '70', '120', '30', '50'),
      notes: '' },
    { offset: 40, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+2,5', '55', '45', '17,5', '9'),
      notes: '' },
    { offset: 41, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('75', '26', '12', '17,5', '16'),
      notes: '' },
    // ── Semana -6 (offsets 43-49) ───────────────────────────────────
    { offset: 44, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('37,5', '6', '5', '40'),
      notes: '' },
    { offset: 46, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('75', '65', '110', '27,5', '45'),
      notes: '' },
    { offset: 47, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('+2,5', '52,5', '42,5', '15', '8'),
      notes: '' },
    { offset: 48, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('72,5', '24', '12', '17,5', '16'),
      notes: '' },
    // ── Semana -7 (offsets 50-56) ───────────────────────────────────
    { offset: 51, plan: 'plan_demo_custom_pred|3',
      exercises: _diaD('35', '6', '5', '40'),
      notes: '' },
    { offset: 53, plan: 'plan_demo_custom_pred|2',
      exercises: _diaC('70', '60', '100', '25', '40'),
      notes: 'Primera semana del nuevo programa.' },
    { offset: 54, plan: 'plan_demo_custom_pred|1',
      exercises: _diaB('0', '50', '40', '15', '8'),
      notes: '' },
    { offset: 55, plan: 'plan_demo_custom_pred|0',
      exercises: _diaA('70', '22', '10', '15', '14'),
      notes: 'Primer día con el plan custom completo.' },
  ];

  return samples.map((s) => ({
    fecha: _offsetToFecha(s.offset),
    plan: s.plan,
    exercises: s.exercises,
    notes: s.notes,
    updatedAt: now - s.offset * 86400000,
  }));
}

// ────────────────────────────────────────────────────────────────────────────

export function demoUserDocument(): UserDocument {
  const now = Date.now();
  return {
    profile: DEMO_PROFILE,
    menu: DEMO_MENU,
    entrenos: DEMO_ENTRENOS,
    compra: DEMO_COMPRA,
    suplementos: DEMO_SUPLEMENTOS,
    // Plan: el invitado es Free por defecto. Aunque no puede usar IA
    // (canGenerateAi devuelve { reason: 'guest' }), el campo existe
    // para que tras vincular a cuenta real (sin perder uid) tenga el
    // mismo schema sin sembrar nada extra.
    plan: defaultPlan(),
    generaciones: defaultGeneraciones(),
    plan_pro: false,
    fecha_expiracion: null,
    fecha_ultima_generacion: null,
    createdAt: now,
    lastActive: now,
    medicalDisclaimerAcceptedAt: null,
    // Flags por día del menú (Sub-fase 2B.6) · arrays vacíos al
    // arrancar. Sin esto, `ensureUserDocumentSchema` los sembraría
    // en cada primer login de invitado disparando un updateDoc extra.
    menuFlags: defaultMenuFlags(),
    isDemo: true,
    // Stats agregadas del registro de pesos (Sub-fase 2E.1) · poblado
    // con 3 PRs y exerciseHistory para que el invitado vea el
    // StatsGrid + sparklines del RegDayPanel + lista de PR's del
    // GraphsModal con datos reales desde el primer login.
    registroStats: DEMO_REGISTRO_STATS,
  };
}

// Re-export del listado de claves para componentes que iteren los días
// del menú demo sin tener que mirar Object.keys (TS inferiría string).
export const DEMO_DAY_ORDER: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

// Devuelve una copia del menú demo para un día concreto. Usado al
// "Resetear día" desde MenuPage en cuentas invitadas (Sub-fase 2B.6) ·
// las cuentas reales no usan el demo, sino `defaultMenu()[day]` (4
// comidas vacías).
export function defaultDemoMenuForDay(day: DayKey) {
  // Clonado profundo · evita que mutaciones posteriores en la card
  // del día afecten a la fuente original DEMO_MENU.
  return JSON.parse(JSON.stringify(DEMO_MENU[day])) as typeof DEMO_MENU[DayKey];
}
