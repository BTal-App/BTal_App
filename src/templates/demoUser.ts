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
  Compra,
  DayKey,
  DiaEntreno,
  Entrenos,
  ItemCompra,
  Menu,
  MealKey,
  Suplementos,
  UserDocument,
  UserProfile,
} from './defaultUser';
import {
  HORA_DEFECTO,
  defaultGeneraciones,
  defaultPlan,
  defaultUserDocument,
} from './defaultUser';

// ── Helpers internos ──────────────────────────────────────────────────────

function comida(
  meal: MealKey,
  alimentos: string[],
  kcal: number,
  prot: number,
  carb: number,
  fat: number,
): Comida {
  return {
    alimentos,
    hora: HORA_DEFECTO[meal],
    kcal,
    prot,
    carb,
    fat,
  };
}

// ── Menú semanal ──────────────────────────────────────────────────────────
// Objetivo aproximado: ~2.000 kcal · ~150 g prot · ~210 g carb · ~60 g fat.
// Volumen ligero para alguien de ~75 kg que entrena 4 días.

const DEMO_MENU: Menu = {
  lun: {
    desayuno: comida('desayuno',
      ['Avena 60 g', 'Leche desnatada 250 ml', '1 plátano mediano', '4 claras de huevo'],
      520, 30, 75, 10),
    comida: comida('comida',
      ['Pechuga de pollo 180 g', 'Arroz integral 80 g', 'Brócoli al vapor'],
      620, 55, 70, 9),
    merienda: comida('merienda',
      ['Yogur griego 200 g', 'Frutos secos 20 g', 'Miel 1 cdta'],
      320, 22, 25, 14),
    cena: comida('cena',
      ['Salmón 200 g', 'Boniato asado 200 g', 'Ensalada mixta'],
      580, 42, 50, 22),
  },
  mar: {
    desayuno: comida('desayuno',
      ['Tortilla francesa 3 huevos', 'Tostada integral', 'Tomate'],
      480, 26, 40, 22),
    comida: comida('comida',
      ['Ternera magra 150 g', 'Pasta integral 80 g', 'Tomate natural'],
      650, 52, 75, 14),
    merienda: comida('merienda',
      ['Skyr 200 g', 'Arándanos 100 g', 'Almendras 15 g'],
      290, 26, 22, 12),
    cena: comida('cena',
      ['Pavo a la plancha 200 g', 'Quinoa 70 g', 'Verduras al horno'],
      560, 44, 55, 16),
  },
  mie: {
    desayuno: comida('desayuno',
      ['Tortitas de avena 50 g', '4 claras', '1 plátano', 'Miel 1 cdta'],
      510, 28, 68, 12),
    comida: comida('comida',
      ['Salmón 180 g', 'Patata cocida 200 g', 'Espinacas salteadas'],
      620, 40, 55, 26),
    merienda: comida('merienda',
      ['Queso fresco batido 200 g', '1 manzana', 'Crema de cacahuete 15 g'],
      310, 24, 28, 12),
    cena: comida('cena',
      ['Pollo al curry 180 g', 'Arroz basmati 80 g', 'Pimientos asados'],
      590, 48, 60, 14),
  },
  jue: {
    desayuno: comida('desayuno',
      ['Avena 60 g', 'Leche desnatada 250 ml', 'Frutos rojos 100 g', '4 claras'],
      500, 30, 72, 8),
    comida: comida('comida',
      ['Pechuga de pollo 180 g', 'Boniato 200 g', 'Brócoli'],
      620, 52, 68, 12),
    merienda: comida('merienda',
      ['Yogur griego 200 g', 'Nueces 20 g', 'Miel 1 cdta'],
      320, 22, 25, 14),
    cena: comida('cena',
      ['Atún fresco 180 g', 'Arroz integral 80 g', '1/2 aguacate'],
      600, 45, 55, 22),
  },
  vie: {
    desayuno: comida('desayuno',
      ['Bowl de avena 60 g', '1 plátano', 'Cacao puro 1 cdta', '2 claras'],
      510, 28, 72, 12),
    comida: comida('comida',
      ['Lentejas 100 g (peso seco)', 'Verduras', 'Arroz blanco 60 g'],
      600, 35, 85, 8),
    merienda: comida('merienda',
      ['Yogur griego 200 g', 'Frutos secos 20 g', 'Miel 1 cdta'],
      320, 22, 25, 14),
    cena: comida('cena',
      ['Salmón 180 g', 'Quinoa 70 g', 'Espárragos a la plancha'],
      590, 40, 52, 22),
  },
  sab: {
    desayuno: comida('desayuno',
      ['Tostadas integrales', '1/2 aguacate', '2 huevos a la plancha', 'Tomate'],
      540, 26, 45, 26),
    comida: comida('comida',
      ['Ternera magra 150 g', 'Pasta integral 80 g', 'Tomate natural'],
      670, 55, 76, 14),
    merienda: comida('merienda',
      ['Skyr 200 g', '1 manzana', 'Crema de cacahuete 15 g'],
      320, 22, 30, 12),
    cena: comida('cena',
      ['Pavo a la plancha 200 g', 'Boniato asado 200 g', 'Espinacas'],
      560, 45, 56, 16),
  },
  dom: {
    desayuno: comida('desayuno',
      ['Tortitas de avena 50 g', '1 plátano', 'Miel 1 cdta', '4 claras'],
      510, 28, 68, 12),
    comida: comida('comida',
      ['Pollo al horno 180 g', 'Arroz integral 80 g', 'Brócoli'],
      600, 52, 68, 10),
    merienda: comida('merienda',
      ['Yogur griego 200 g', 'Arándanos 100 g', 'Almendras 15 g'],
      320, 24, 22, 14),
    cena: comida('cena',
      ['Salmón 200 g', 'Patata cocida 200 g', 'Espárragos'],
      580, 42, 50, 24),
  },
};

// ── Plan de entreno · 4 días Push/Pull/Legs/Brazos ────────────────────────

const DEMO_DIAS_4: DiaEntreno[] = [
  {
    letra: 'A',
    nombre: 'Empuje',
    tags: ['Pecho', 'Tríceps', 'Hombros'],
    diaSemana: 'lun',
    duracionMin: 65,
    ejercicios: [
      { nombre: 'Press banca con barra', setsReps: '4×6-8', nota: 'Calentamiento progresivo', pesoKg: 80, tipo: 'fuerza' },
      { nombre: 'Press inclinado mancuernas', setsReps: '3×8-10', nota: 'Inclinación 30°', pesoKg: 24, tipo: 'hipertrofia' },
      { nombre: 'Aperturas en polea', setsReps: '3×12', nota: 'Contracción controlada', pesoKg: 12, tipo: 'hipertrofia' },
      { nombre: 'Fondos en paralelas', setsReps: '3×8-10', nota: 'Lastrado si puedes', pesoKg: 10, tipo: 'fuerza' },
      { nombre: 'Press francés barra Z', setsReps: '3×10', pesoKg: 25, tipo: 'hipertrofia' },
      { nombre: 'Extensiones tríceps polea', setsReps: '3×12', nota: 'Cuerda', pesoKg: 18, tipo: 'hipertrofia' },
    ],
  },
  {
    letra: 'B',
    nombre: 'Tirón',
    tags: ['Espalda', 'Bíceps'],
    diaSemana: 'mar',
    duracionMin: 60,
    ejercicios: [
      { nombre: 'Dominadas', setsReps: '4×6-8', nota: 'Lastradas si puedes', pesoKg: 5, tipo: 'fuerza' },
      { nombre: 'Remo con barra', setsReps: '4×8', pesoKg: 70, tipo: 'fuerza' },
      { nombre: 'Jalón al pecho', setsReps: '3×10', pesoKg: 55, tipo: 'hipertrofia' },
      { nombre: 'Curl con barra Z', setsReps: '3×8-10', pesoKg: 25, tipo: 'hipertrofia' },
      { nombre: 'Curl martillo', setsReps: '3×12', nota: 'Alternando', pesoKg: 14, tipo: 'hipertrofia' },
    ],
  },
  {
    letra: 'C',
    nombre: 'Pierna',
    tags: ['Piernas', 'Fuerza'],
    diaSemana: 'jue',
    duracionMin: 70,
    ejercicios: [
      { nombre: 'Sentadilla con barra', setsReps: '4×6-8', nota: 'Bajo paralelo', pesoKg: 100, tipo: 'fuerza' },
      { nombre: 'Peso muerto rumano', setsReps: '4×8', pesoKg: 80, tipo: 'fuerza' },
      { nombre: 'Prensa 45°', setsReps: '3×10', pesoKg: 150, tipo: 'hipertrofia' },
      { nombre: 'Zancadas con mancuernas', setsReps: '3×10', pesoKg: 16, tipo: 'hipertrofia' },
    ],
  },
  {
    letra: 'D',
    nombre: 'Hombro y brazos',
    tags: ['Hombros', 'Bíceps', 'Tríceps'],
    diaSemana: 'vie',
    duracionMin: 55,
    ejercicios: [
      { nombre: 'Press militar mancuernas', setsReps: '4×8', pesoKg: 18, tipo: 'fuerza' },
      { nombre: 'Elevaciones laterales', setsReps: '3×12', pesoKg: 10, tipo: 'hipertrofia' },
      { nombre: 'Pájaros con mancuernas', setsReps: '3×12', pesoKg: 8, tipo: 'hipertrofia' },
      { nombre: 'Curl alterno', setsReps: '3×10', pesoKg: 14, tipo: 'hipertrofia' },
      { nombre: 'Patada de tríceps polea', setsReps: '3×12', pesoKg: 10, tipo: 'hipertrofia' },
    ],
  },
];

// Para los demás planes (1-3, 5-7) dejamos los días vacíos del default —
// el demo solo trae rellenos los 4 días del plan recomendado.
const DEMO_ENTRENOS: Entrenos = {
  ...defaultUserDocument().entrenos,
  planes: {
    ...defaultUserDocument().entrenos.planes,
    4: {
      diasPorSemana: 4,
      nombre: 'Plan 4 días — Push/Pull/Legs + Brazos',
      dias: DEMO_DIAS_4,
    },
  },
  planActivo: 4,
};

// ── Lista de la compra (los 12 productos del v2) ──────────────────────────

const itemBought = (nombre: string, cantidad: string, precio: number): ItemCompra => ({
  nombre,
  cantidad,
  comprado: true,
  precio,
});

const itemPending = (nombre: string, cantidad: string, precio: number): ItemCompra => ({
  nombre,
  cantidad,
  comprado: false,
  precio,
});

const DEMO_COMPRA: Compra = {
  proteinas: [
    itemBought('Pechuga de pollo', '1 kg', 8.4),
    itemPending('Salmón fresco', '500 g', 12.9),
    itemPending('Huevos', '1 docena', 3.2),
  ],
  lacteos: [
    itemBought('Yogur griego', 'Pack 4 ud', 3.5),
    itemPending('Leche desnatada', '1 L', 1.1),
  ],
  hidratos: [],
  frutas_verduras: [
    itemBought('Plátanos', '1 kg', 1.2),
    itemBought('Manzanas', '1 kg', 1.8),
    itemPending('Brócoli', '1 ud', 2.0),
    itemPending('Espinacas', '500 g', 1.5),
    itemPending('Tomates', '1 kg', 2.2),
  ],
  despensa: [],
  grasas: [],
  suplementacion: [
    itemBought('Whey protein', '750 g', 14.9),
    itemBought('Creatina monohidrato', '300 g', 9.9),
  ],
};

// ── Suplementos · contadores de dosis restantes ───────────────────────────

const DEMO_SUPLEMENTOS: Suplementos = {
  batidos_restantes: 18, // 750 g whey / ~35 g por batido ≈ 21, ya tomó 3
  creatina_dosis_restantes: 42, // ~50 días con 5 g/día, ya tomó 8
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
  modo: 'manual', // el invitado no puede usar IA por diseño
  aiScope: null,
  completed: true,
};

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
    isDemo: true,
  };
}

// Re-export del listado de claves para componentes que iteren los días
// del menú demo sin tener que mirar Object.keys (TS inferiría string).
export const DEMO_DAY_ORDER: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
