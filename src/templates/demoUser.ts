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
  Entrenos,
  ItemCompra,
  Menu,
  MealKey,
  Suplementos,
  UserDocument,
  UserProfile,
} from './defaultUser';
import {
  DAY_KEYS,
  DEFAULT_COMPRA_CATEGORIAS,
  HORA_DEFECTO,
  defaultGeneraciones,
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

// Construye el Menu final con `extras: []` en cada día. El lunes lleva
// un extra precargado ("Pre-entreno") para que el invitado vea la feature
// funcionando al instante en lugar de tener que crear uno desde cero.
const DEMO_MENU: Menu = Object.fromEntries(
  DAY_KEYS.map((day) => [
    day,
    {
      ...DEMO_DAYS[day],
      extras:
        day === 'lun'
          ? [
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
                source: 'default' as const,
              },
            ]
          : [],
    },
  ]),
) as Menu;

// ── Plan de entreno · 4 días Push/Pull/Legs/Brazos ────────────────────────

// Demo entrenos · usa el `defaultEntrenos()` que ya incluye el plan 4
// días con ejemplo Push/Pull/Legs (sub-fase 2D). El user invitado lo ve
// cargado de inicio · si quiere otro plan, edita o crea custom.
const DEMO_ENTRENOS: Entrenos = defaultUserDocument().entrenos;

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
    ],
    lacteos: [
      itemBought('lacteos', 1, 'Yogur griego', 'Pack 4 ud', 3.5),
      itemPending('lacteos', 2, 'Leche desnatada', '1 L', 1.1),
    ],
    hidratos: [],
    frutas_verduras: [
      itemBought('frutas_verduras', 1, 'Plátanos', '1 kg', 1.2),
      itemBought('frutas_verduras', 2, 'Manzanas', '1 kg', 1.8),
      itemPending('frutas_verduras', 3, 'Brócoli', '1 ud', 2.0),
      itemPending('frutas_verduras', 4, 'Espinacas', '500 g', 1.5),
      itemPending('frutas_verduras', 5, 'Tomates', '1 kg', 2.2),
    ],
    despensa: [],
    grasas: [],
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
const DEMO_SEMANA_INICIO = Date.now() - 5 * 24 * 60 * 60 * 1000; // hace 5 días
const DEMO_MES_INICIO = Date.now() - 14 * 24 * 60 * 60 * 1000; // hace 2 semanas

const DEMO_SUPLEMENTOS: Suplementos = {
  // Stock en gramos · igual que el v1. Bote típico de whey 750g con dosis
  // de 35g → 21 batidos posibles. Bote de creatina 300g con 3g/dosis →
  // 100 dosis posibles. Tomados: 3 batidos y 8 dosis.
  batido_stock_gramos: 750,
  creatina_stock_gramos: 300,
  batidos_tomados_total: 3,
  creatinas_tomadas_total: 8,
  // Counters semanal/mensual/anual precargados · para que el invitado
  // vea las cuatro métricas (semana / mes / año / total) al entrar.
  batidos_tomados_semana: 1,
  batidos_tomados_mes: 3,
  batidos_tomados_anio: 3,
  creatinas_tomadas_semana: 2,
  creatinas_tomadas_mes: 8,
  creatinas_tomadas_anio: 8,
  batido_semana_inicio: DEMO_SEMANA_INICIO,
  batido_mes_inicio: DEMO_MES_INICIO,
  batido_anio_inicio: DEMO_MES_INICIO,
  creatina_semana_inicio: DEMO_SEMANA_INICIO,
  creatina_mes_inicio: DEMO_MES_INICIO,
  creatina_anio_inicio: DEMO_MES_INICIO,
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
  creatinaOverrides: {},
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
  notas: '',
  intolerancias: [],
  alergias: [],
  alimentosProhibidos: [],
  alimentosObligatorios: [],
  ingredientesFavoritos: [],
  objetivoKcal: 2200, // calculado: hombre 28a · 75kg · 178cm · moderado · volumen
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

// Devuelve una copia del menú demo para un día concreto. Usado al
// "Resetear día" desde MenuPage en cuentas invitadas (Sub-fase 2B.6) ·
// las cuentas reales no usan el demo, sino `defaultMenu()[day]` (4
// comidas vacías).
export function defaultDemoMenuForDay(day: DayKey) {
  // Clonado profundo · evita que mutaciones posteriores en la card
  // del día afecten a la fuente original DEMO_MENU.
  return JSON.parse(JSON.stringify(DEMO_MENU[day])) as typeof DEMO_MENU[DayKey];
}
