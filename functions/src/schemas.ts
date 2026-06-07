// Schemas Zod · dos usos:
//   1. Validación server-side del perfil ANTES de construir el prompt
//      (roadmap 6-7 · no confiar en el cliente · re-validar rangos).
//   2. Validación de la respuesta JSON de Gemini ANTES de persistir
//      (roadmap 6-8 · la IA a veces devuelve campos extra o mal tipados).
//
// Ya NO usamos responseSchema con Gemini (lo rechazaba por complejidad) ·
// la respuesta se guía por el esqueleto JSON del prompt y se valida aquí.

import { z } from 'zod';
import { DAY_KEYS } from './types.js';

// ── 1. Perfil de entrada (validación server-side) ──
// Rangos espejados de la validación del onboarding (Onboarding.tsx) +
// roadmap 6-7. Si el cliente manipulado manda peso:-50, esto lo rechaza.
export const profileSchema = z.object({
  nombre: z.string().max(64),
  edad: z.number().int().min(14).max(90),
  peso: z.number().min(30).max(300),
  altura: z.number().min(120).max(230),
  sexo: z.enum(['m', 'f']),
  actividad: z.enum(['sedentario', 'ligero', 'moderado', 'activo', 'muy_activo']),
  diasEntreno: z.number().int().min(0).max(7),
  equipamiento: z.enum(['gimnasio', 'casa', 'sin_material']),
  objetivo: z.enum(['volumen', 'definicion', 'recomposicion', 'mantenimiento']),
  restricciones: z.array(z.string().max(40)).max(20),
  notas: z.string().max(1000),
  intolerancias: z.array(z.string().max(40)).max(30),
  alergias: z.array(z.string().max(40)).max(30),
  alimentosProhibidos: z.array(z.string().max(60)).max(40),
  alimentosObligatorios: z.array(z.string().max(60)).max(40),
  ingredientesFavoritos: z.array(z.string().max(60)).max(40),
  objetivoKcal: z.number().min(800).max(6000).nullable(),
  supermercados: z.array(z.string().max(40)).max(15).optional(),
});

export type ValidatedProfile = z.infer<typeof profileSchema>;

// ── 2. Respuesta de Gemini (shapes "generadas", simples) ──

const generatedMealSchema = z.object({
  nombrePlato: z.string().min(1).max(150),
  alimentos: z
    .array(
      z.object({
        nombre: z.string().min(1).max(150),
        cantidad: z.string().max(100), // verboso: "1 cucharada de aceite de oliva virgen extra"
      }),
    )
    .min(1)
    .max(25),
  kcal: z.number().min(0).max(6000),
  prot: z.number().min(0).max(600),
  carb: z.number().min(0).max(1000),
  fat: z.number().min(0).max(500),
});
export type GeneratedMeal = z.infer<typeof generatedMealSchema>;

// Comida extra generada · una comida normal + un título de slot (nombre,
// ej. "Media mañana", "Recena") y una hora orientativa "HH:mm". La IA las
// añade SOLO cuando ayuda a repartir las kcal (objetivos altos). LENIENTE
// con la hora · persist la valida/normaliza.
const generatedExtraSchema = generatedMealSchema.extend({
  nombre: z.string().min(1).max(40),
  hora: z.string().max(8).nullable(),
});
export type GeneratedExtra = z.infer<typeof generatedExtraSchema>;

const generatedDaySchema = z.object({
  desayuno: generatedMealSchema,
  comida: generatedMealSchema,
  merienda: generatedMealSchema,
  cena: generatedMealSchema,
  // Extras opcionales que la IA puede añadir (0-4) para no inflar las 4
  // fijas en objetivos altos. Si la IA las omite, día = solo 4 fijas.
  extras: z.array(generatedExtraSchema).max(4).optional(),
});

// El menú generado · objeto con las 7 claves de día.
const generatedMenuSchema = z.object(
  Object.fromEntries(DAY_KEYS.map((d) => [d, generatedDaySchema])) as Record<
    (typeof DAY_KEYS)[number],
    typeof generatedDaySchema
  >,
);
export type GeneratedMenu = z.infer<typeof generatedMenuSchema>;

const generatedExerciseSchema = z.object({
  nombre: z.string().min(1).max(150),
  series: z.string().min(1).max(80), // "4x8-10 @ RIR 2 (descanso 90s)", etc.
  desc: z.string().max(300),
});

const generatedTrainingDaySchema = z.object({
  titulo: z.string().min(1).max(150),
  descripcion: z.string().max(300),
  // LENIENTE a propósito: el LLM a veces escribe "lunes" en vez de "lun".
  // Aceptamos cualquier string y lo normalizamos a DayKey|null en persist.
  diaSemana: z.string().nullable(),
  // tiempoEstimadoMin · sin min/max estricto · el LLM puede dar valores
  // raros · persist lo usa tal cual (es informativo). Acepta number o null.
  tiempoEstimadoMin: z.number().nullable(),
  // LENIENTE: el LLM ignora a veces el "máximo 3" y devuelve más, o usa
  // badges fuera de la lista. Aceptamos strings libres y en persist
  // filtramos a los válidos + nos quedamos con los 3 primeros.
  badges: z.array(z.string()).min(1).max(20),
  ejercicios: z.array(generatedExerciseSchema).min(1).max(20),
  comentario: z.string().max(600),
});
export type GeneratedTrainingDay = z.infer<typeof generatedTrainingDaySchema>;

// Array de días de un plan · lenient (min 1, max 8) · persist ajusta al
// número exacto del builtin correspondiente.
const trainingDaysArray = z.array(generatedTrainingDaySchema).min(1).max(8);

// Entrenos generados · un plan por cada número de días (1..7), para
// rellenar los 7 planes builtin (1dias..7dias). Cada clave "N" trae N días
// con el split apropiado. Decisión 29-may: la IA rellena TODOS los builtin
// (no crea un plan nuevo suelto) · así el user puede cambiar de días y
// tener siempre un plan IA listo.
const generatedEntrenosSchema = z.object({
  '1': trainingDaysArray,
  '2': trainingDaysArray,
  '3': trainingDaysArray,
  '4': trainingDaysArray,
  '5': trainingDaysArray,
  '6': trainingDaysArray,
  '7': trainingDaysArray,
});
export type GeneratedEntrenos = z.infer<typeof generatedEntrenosSchema>;

// Respuesta completa · ambas partes opcionales según scope. La función
// pide solo lo que el scope necesita; valida lo que llegó.
//
// La IA NUNCA genera nombres de plan: los 7 builtin conservan su "Plan N
// Días" (ver persist.mapAllBuiltInPlans). Por eso aquí no hay planNombre.
// Recomendación de suplementos · días (lun..dom) en que tomar batido de
// proteína y creatina. LENIENTE: strings libres (persist los normaliza a
// DayKey con normalizeDiaSemana y descarta los inválidos). Solo llega en
// scope 'all'.
const generatedSuplementosSchema = z.object({
  batidoDias: z.array(z.string()).max(10),
  creatinaDias: z.array(z.string()).max(10),
  // El "check" includeCreatina del batido · la IA decide si la creatina va
  // DENTRO del batido. Default false si la IA lo omite (no rompe la parse).
  creatinaEnBatido: z.boolean().default(false),
  // Macros del batido que la IA propone (solo si recomienda batido y quiere
  // ajustarlas). El menú se cuadra contando estas macros en los días con
  // batido. Si se omite, se conserva la config actual del user. Rangos
  // generosos · persist redondea.
  batidoMacros: z
    .object({
      grProt: z.number().min(0).max(120),
      kcal: z.number().min(0).max(2000),
      prot: z.number().min(0).max(200),
      carb: z.number().min(0).max(300),
      fat: z.number().min(0).max(150),
    })
    .nullish(),
});
export type GeneratedSuplementos = z.infer<typeof generatedSuplementosSchema>;

export const geminiResponseSchema = z.object({
  menu: generatedMenuSchema.optional(),
  entrenos: generatedEntrenosSchema.optional(),
  suplementos: generatedSuplementosSchema.optional(),
});
