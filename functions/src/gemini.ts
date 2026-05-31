// Cliente Gemini · @google/genai (SDK unificado de Google GenAI).
//
// Modelo: gemini-3.5-flash · flash de última generación (gama flash, no
// lite). Subido desde gemini-2.5-flash-lite (31-may): el lite tenía un
// sesgo fuerte a infra-dimensionar las raciones (~73% del objetivo kcal)
// que el prompt no corregía. Un modelo más capaz dimensiona mejor las
// raciones por sí mismo (sin normalización artificial). Sigue siendo gama
// flash → coste bajo. Revertir = cambiar esta constante + redeploy.
//
// SALIDA JSON SIN responseSchema (decisión 29-may-2026):
//   Inicialmente usábamos `responseSchema` (structured output) con el
//   shape completo (7 días × 4 comidas anidadas + macros con min/max).
//   Gemini lo rechazaba con 400 "schema produces a constraint that has
//   too many states for serving" · el schema era demasiado complejo
//   (límite de estados de Gemini). Solución robusta: usar solo
//   `responseMimeType: 'application/json'` (fuerza JSON crudo, sin
//   markdown) + un esqueleto JSON explícito en el prompt que describe
//   las claves exactas + validación Zod de la respuesta en generatePlan.
//   Mismo resultado, sin el límite de complejidad.
//
// La API key llega como argumento (la función la lee del secret de
// Firebase GEMINI_API_KEY) · NUNCA hardcodeada ni en el bundle.

import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.5-flash';

export interface CallGeminiArgs {
  apiKey: string;
  systemInstruction: string;
  prompt: string;
}

// Quita fences markdown (```json ... ```) por si el modelo los añade
// pese a responseMimeType · defensa antes del JSON.parse.
function stripCodeFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

// Llama a Gemini y devuelve el texto JSON crudo (el caller lo valida con
// Zod). Lanza si la API falla o devuelve vacío.
export async function callGemini(args: CallGeminiArgs): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: args.apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: args.prompt,
    config: {
      systemInstruction: args.systemInstruction,
      // Fuerza JSON crudo (sin markdown). Sin responseSchema · el shape
      // lo guía el esqueleto del prompt + lo valida Zod.
      responseMimeType: 'application/json',
      temperature: 0.8,
      // Scope 'all' genera menú (7×4) + los 7 planes builtin (28 días) +
      // suplementos en un solo JSON · eso supera con holgura los 16k tokens
      // y se truncaba ("Unterminated string in JSON" → JSON.parse falla →
      // perfil vacío). Subimos al máximo del modelo (65536). NO encarece:
      // se factura por tokens realmente generados, el cap solo evita el corte.
      maxOutputTokens: 65536,
    },
  });
  const text = response.text;
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }
  return stripCodeFences(text);
}
