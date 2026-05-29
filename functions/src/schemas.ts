// Schemas Zod · dos usos:
//   1. Validación server-side del perfil ANTES de construir el prompt
//      (roadmap 6-7 · no confiar en el cliente · re-validar rangos).
//   2. Validación de la respuesta JSON de Gemini ANTES de persistir
//      (roadmap 6-8 · la IA a veces devuelve campos extra o mal tipados).
//
// El responseSchema que se le PASA a Gemini (formato OpenAPI) vive en
// gemini.ts · esto es la red de seguridad de PARSEO de lo que vuelve.

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
  nombrePlato: z.string().min(1).max(120),
  alimentos: z
    .array(
      z.object({
        nombre: z.string().min(1).max(120),
        cantidad: z.string().max(40),
      }),
    )
    .min(1)
    .max(20),
  kcal: z.number().min(0).max(5000),
  prot: z.number().min(0).max(500),
  carb: z.number().min(0).max(800),
  fat: z.number().min(0).max(400),
});
export type GeneratedMeal = z.infer<typeof generatedMealSchema>;

const generatedDaySchema = z.object({
  desayuno: generatedMealSchema,
  comida: generatedMealSchema,
  merienda: generatedMealSchema,
  cena: generatedMealSchema,
});

// El menú generado · objeto con las 7 claves de día.
export const generatedMenuSchema = z.object(
  Object.fromEntries(DAY_KEYS.map((d) => [d, generatedDaySchema])) as Record<
    (typeof DAY_KEYS)[number],
    typeof generatedDaySchema
  >,
);
export type GeneratedMenu = z.infer<typeof generatedMenuSchema>;

const generatedExerciseSchema = z.object({
  nombre: z.string().min(1).max(120),
  series: z.string().min(1).max(40),
  desc: z.string().max(200),
});

const generatedTrainingDaySchema = z.object({
  titulo: z.string().min(1).max(120),
  descripcion: z.string().max(200),
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
  comentario: z.string().max(400),
});
export type GeneratedTrainingDay = z.infer<typeof generatedTrainingDaySchema>;

export const generatedTrainingPlanSchema = z.object({
  nombre: z.string().min(1).max(60),
  dias: z.array(generatedTrainingDaySchema).min(1).max(7),
});
export type GeneratedTrainingPlan = z.infer<typeof generatedTrainingPlanSchema>;

// Respuesta completa · ambas partes opcionales según scope. La función
// pide solo lo que el scope necesita; valida lo que llegó.
export const geminiResponseSchema = z.object({
  menu: generatedMenuSchema.optional(),
  entreno: generatedTrainingPlanSchema.optional(),
});
export type GeminiResponse = z.infer<typeof geminiResponseSchema>;
