// Cliente Gemini · @google/genai (SDK unificado de Google GenAI).
//
// Modelo: gemini-2.5-flash-lite · el más barato + rápido de la familia
// 2.5, suficiente para generación estructurada de planes. Structured
// output vía responseSchema (formato OpenAPI subset) + responseMimeType
// 'application/json' para que la respuesta sea JSON parseable garantizado.
//
// La API key llega como argumento (la función la lee del secret de
// Firebase GEMINI_API_KEY) · NUNCA hardcodeada ni en el bundle.

import { GoogleGenAI, Type } from '@google/genai';
import { DAY_KEYS, MEAL_KEYS } from './types.js';

const MODEL = 'gemini-2.5-flash-lite';

// ── Builders del responseSchema (formato OpenAPI que entiende Gemini) ──

function mealSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      nombrePlato: {
        type: Type.STRING,
        description: 'Nombre del plato, 3-7 palabras, primera mayúscula, sin punto final',
      },
      alimentos: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            cantidad: { type: Type.STRING, description: 'ej. "60 g", "250 ml", "1 unidad"' },
          },
          required: ['nombre', 'cantidad'],
        },
      },
      kcal: { type: Type.NUMBER },
      prot: { type: Type.NUMBER, description: 'gramos de proteína' },
      carb: { type: Type.NUMBER, description: 'gramos de carbohidratos' },
      fat: { type: Type.NUMBER, description: 'gramos de grasa' },
    },
    required: ['nombrePlato', 'alimentos', 'kcal', 'prot', 'carb', 'fat'],
  };
}

function daySchema() {
  return {
    type: Type.OBJECT,
    properties: Object.fromEntries(MEAL_KEYS.map((m) => [m, mealSchema()])),
    required: [...MEAL_KEYS],
  };
}

function menuSchema() {
  return {
    type: Type.OBJECT,
    properties: Object.fromEntries(DAY_KEYS.map((d) => [d, daySchema()])),
    required: [...DAY_KEYS],
  };
}

function trainingSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      nombre: { type: Type.STRING, description: 'Nombre corto del plan, ej. "Push Pull Legs"' },
      dias: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING, description: 'ej. "Día A · Empuje"' },
            descripcion: { type: Type.STRING, description: 'ej. "Pecho · Hombros · Tríceps"' },
            diaSemana: {
              type: Type.STRING,
              nullable: true,
              enum: [...DAY_KEYS],
              description: 'Día de la semana asignado o null',
            },
            tiempoEstimadoMin: { type: Type.INTEGER, nullable: true },
            badges: {
              type: Type.ARRAY,
              description: '1-3 etiquetas de grupo muscular o tipo',
              items: {
                type: Type.STRING,
                enum: [
                  'pecho', 'espalda', 'piernas', 'hombros', 'biceps', 'triceps',
                  'core', 'fullbody', 'fuerza', 'hipertrofia', 'resistencia',
                  'cardio', 'movilidad', 'empuje', 'tiron',
                ],
              },
            },
            ejercicios: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  series: { type: Type.STRING, description: 'ej. "4×8-10", "3×12", "30 min"' },
                  desc: { type: Type.STRING, description: 'nota técnica corta, puede ir vacía' },
                },
                required: ['nombre', 'series', 'desc'],
              },
            },
            comentario: { type: Type.STRING, description: 'notas finales del día, puede ir vacía' },
          },
          required: ['titulo', 'descripcion', 'diaSemana', 'tiempoEstimadoMin', 'badges', 'ejercicios', 'comentario'],
        },
      },
    },
    required: ['nombre', 'dias'],
  };
}

// Construye el responseSchema según qué partes pide el scope.
export function buildResponseSchema(opts: { menu: boolean; entreno: boolean }) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  if (opts.menu) {
    properties.menu = menuSchema();
    required.push('menu');
  }
  if (opts.entreno) {
    properties.entreno = trainingSchema();
    required.push('entreno');
  }
  return { type: Type.OBJECT, properties, required };
}

export interface CallGeminiArgs {
  apiKey: string;
  systemInstruction: string;
  prompt: string;
  wantMenu: boolean;
  wantEntreno: boolean;
}

// Llama a Gemini y devuelve el texto JSON crudo (sin parsear · el caller
// lo valida con Zod). Lanza si la API falla o devuelve vacío.
export async function callGemini(args: CallGeminiArgs): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: args.apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: args.prompt,
    config: {
      systemInstruction: args.systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema({
        menu: args.wantMenu,
        entreno: args.wantEntreno,
      }),
      // Temperatura media · variedad razonable sin alucinar macros locos.
      temperature: 0.8,
      // Cota dura de salida · un menú+plan completo cabe sobrado en 8k tokens.
      maxOutputTokens: 8192,
    },
  });
  const text = response.text;
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }
  return text;
}

export { MODEL as GEMINI_MODEL };
