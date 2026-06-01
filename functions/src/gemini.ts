// Cliente Gemini · @google/genai (SDK unificado de Google GenAI).
//
// Modelo: gemini-2.5-flash · flash COMPLETO (no lite) · sweet spot
// capacidad/precio. Historia (31-may): se venía de gemini-2.5-flash-lite,
// que infra-dimensionaba las raciones (~73% del objetivo kcal) sin que el
// prompt lo corrigiera. Se probó gemini-3.5-flash pero su precio es
// desproporcionado ($1,50/$9,00 por 1M · output ×22,5 vs lite, casi tarifa
// premium). gemini-2.5-flash ($0,30/$2,50) es ~3,6× más barato que 3.5-flash
// y mucho más capaz que el lite → mejor relación. Si aún se queda corto,
// subir a 3.5-flash; revertir/cambiar = esta constante + redeploy.
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

const MODEL = 'gemini-2.5-flash';

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
      // THINKING OFF (1-jun-2026) · gemini-2.5-flash trae razonamiento
      // ("thinking") ACTIVADO por defecto con presupuesto dinámico (puede
      // gastar miles de tokens razonando ANTES de responder). El -lite no lo
      // hacía → al migrar, scope "Todo" pasó de ~40s a +120s y la función
      // moría con 504 (timeout). No necesitamos que el modelo razone los
      // macros: el sistema 6B (resolveMenuMacros + enrichAndAdjustMenu) ajusta
      // los gramos al objetivo server-side DESPUÉS. El modelo solo arma la
      // estructura y elige alimentos/ejercicios coherentes, para lo que
      // 2.5-flash es sobrado sin thinking. budget 0 = desactivado. Si en
      // algún momento se nota peor calidad estructural, subir a ~256-512.
      thinkingConfig: { thinkingBudget: 0 },
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
