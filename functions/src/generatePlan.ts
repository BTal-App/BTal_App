// generatePlan · Cloud Function callable (núcleo de la Fase 6).
//
// Orquesta: auth + App Check → validación input → rate limit → ciclo +
// elegibilidad (free/one_off/pro) → validación perfil server-side →
// prompt sanitizado → Gemini structured output → validación Zod de la
// respuesta → persistencia respetando contratos → update generaciones.
//
// La VERDAD del límite vive aquí (el cliente solo lo replica para UX).
// App Check enforce bloquea Postman/cURL/scripts contra la quota Gemini.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

import type { AiScopeChoice, UserDocument } from './types.js';
import { profileSchema, geminiResponseSchema } from './schemas.js';
import { buildPrompt, buildSystemInstruction } from './prompt.js';
import { callGemini } from './gemini.js';
import { checkEligibility, maybeResetCycle } from './eligibility.js';
import { enforceRateLimit } from './rateLimit.js';
import { enforceGlobalDailyCap } from './globalQuota.js';
import {
  mapAllBuiltInPlans,
  mapMenu,
  reconcileMealMacros,
} from './persist.js';
import { deriveShoppingList } from './shoppingList.js';

const geminiKey = defineSecret('GEMINI_API_KEY');

const VALID_SCOPES: AiScopeChoice[] = ['all', 'menu_compra', 'menu_only', 'entrenos_only'];

// Deriva qué partes genera cada scope.
function scopeParts(scope: AiScopeChoice): {
  wantMenu: boolean;
  wantEntreno: boolean;
  deriveCompra: boolean;
} {
  switch (scope) {
    case 'all':
      return { wantMenu: true, wantEntreno: true, deriveCompra: true };
    case 'menu_compra':
      return { wantMenu: true, wantEntreno: false, deriveCompra: true };
    case 'menu_only':
      return { wantMenu: true, wantEntreno: false, deriveCompra: false };
    case 'entrenos_only':
      return { wantMenu: false, wantEntreno: true, deriveCompra: false };
  }
}

interface GenerateRequest {
  scope?: unknown;
  allowUserItems?: unknown;
  // excludedIds se acepta pero en 6A la protección se hace por source.
  excludedIds?: unknown;
}

export const generatePlan = onCall(
  {
    secrets: [geminiKey],
    enforceAppCheck: true,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    // ── 1. Auth ──
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const uid = request.auth.uid;
    const signInProvider = request.auth.token.firebase?.sign_in_provider;
    if (signInProvider === 'anonymous') {
      throw new HttpsError('permission-denied', 'Crea una cuenta para usar la IA.');
    }

    // ── 2. Validar input ──
    const body = (request.data ?? {}) as GenerateRequest;
    const scope = body.scope as AiScopeChoice;
    if (typeof scope !== 'string' || !VALID_SCOPES.includes(scope)) {
      throw new HttpsError('invalid-argument', 'Scope no válido.');
    }
    const allowUserItems = body.allowUserItems === true;

    const db = getFirestore();
    const now = Date.now();

    // ── 3. Rate limit por UID (anti bucle Pro) ──
    try {
      await enforceRateLimit(db, uid, now);
    } catch (err) {
      if ((err as Error).name === 'RateLimitError') {
        throw new HttpsError(
          'resource-exhausted',
          'Demasiadas generaciones seguidas. Espera un momento e inténtalo de nuevo.',
        );
      }
      throw err;
    }

    // ── 4. Leer doc ──
    const ref = db.doc(`users/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Perfil no encontrado. Completa el onboarding.');
    }
    const userDoc = snap.data() as UserDocument;

    if (userDoc.profile?.modo !== 'ai') {
      throw new HttpsError('failed-precondition', 'Activa el modo IA en Ajustes para generar tu plan.');
    }

    // ── 5. Ciclo + elegibilidad (la verdad del límite) ──
    const { reset, next: genAfterReset } = maybeResetCycle(userDoc.generaciones, now);
    const decision = checkEligibility(userDoc.plan, genAfterReset, now);
    if (!decision.allowed) {
      throw new HttpsError('resource-exhausted', 'limit_reached', {
        unlocksAt: decision.unlocksAt,
      });
    }

    // ── 6. Validación server-side del perfil (roadmap 6-7) ──
    const parsedProfile = profileSchema.safeParse(userDoc.profile);
    if (!parsedProfile.success) {
      logger.warn('[generatePlan] perfil inválido', { uid, issues: parsedProfile.error.issues });
      throw new HttpsError(
        'failed-precondition',
        'Tu perfil tiene datos incompletos o fuera de rango. Revísalo en Ajustes.',
      );
    }
    const profile = parsedProfile.data;

    // ── 6b. Cap diario global (protección presupuesto · ataca el gasto
    // Gemini sin tumbar la app). Se cuenta solo aquí, tras pasar todos los
    // checks previos · una generación que llega aquí va a llamar a Gemini. ──
    try {
      await enforceGlobalDailyCap(db, now);
    } catch (err) {
      if ((err as Error).name === 'GlobalCapError') {
        throw new HttpsError(
          'unavailable',
          'Estamos recibiendo muchas solicitudes ahora mismo. Inténtalo de nuevo más tarde.',
        );
      }
      throw err;
    }

    // ── 7. Prompt + Gemini ──
    const { wantMenu, wantEntreno, deriveCompra } = scopeParts(scope);
    const prompt = buildPrompt(profile, { scope, wantMenu, wantEntreno });
    const systemInstruction = buildSystemInstruction();

    let rawJson: string;
    try {
      rawJson = await callGemini({
        apiKey: geminiKey.value(),
        systemInstruction,
        prompt,
      });
    } catch (err) {
      logger.error('[generatePlan] Gemini falló', { uid, scope, err: String(err) });
      throw new HttpsError('unavailable', 'La IA no está disponible ahora mismo. Inténtalo en unos minutos.');
    }

    // ── 8. Validar JSON de Gemini (roadmap 6-8) ──
    let parsed;
    try {
      parsed = geminiResponseSchema.parse(JSON.parse(rawJson));
    } catch (err) {
      logger.error('[generatePlan] respuesta IA inválida', { uid, scope, err: String(err) });
      throw new HttpsError('internal', 'La IA devolvió una respuesta inesperada. Vuelve a intentarlo.');
    }
    if (wantMenu && !parsed.menu) {
      throw new HttpsError('internal', 'La IA no generó el menú. Vuelve a intentarlo.');
    }
    if (wantEntreno && !parsed.entrenos) {
      throw new HttpsError('internal', 'La IA no generó los planes de entreno. Vuelve a intentarlo.');
    }

    // ── 9. Mapear a Firestore aplicando contratos ──
    const updates: Record<string, unknown> = {};

    if (wantMenu && parsed.menu) {
      const menu = reconcileMealMacros(mapMenu(parsed.menu, userDoc.menu, !allowUserItems));
      updates.menu = menu;
      if (deriveCompra) {
        updates.compra = deriveShoppingList(userDoc.compra, menu, 'ai');
      }
    }

    if (wantEntreno && parsed.entrenos) {
      // Rellena los 7 planes builtin · activo = el que coincide con diasEntreno.
      updates.entrenos = mapAllBuiltInPlans(userDoc.entrenos, parsed.entrenos, profile.diasEntreno);
    }

    // ── 10. Generaciones + plan + legacy ──
    const genUpdate = { ...genAfterReset };
    genUpdate.consumidas_ciclo = genAfterReset.consumidas_ciclo + 1;
    if (reset) genUpdate.ciclo_inicio = now;
    if (wantMenu) genUpdate.menu_at = now;
    if (wantEntreno) genUpdate.entrenos_at = now;
    updates.generaciones = genUpdate;

    // Si fue una generación con pago único, márcalo consumido.
    if (decision.allowed && decision.reason === 'one_off' && decision.consumeOneOff) {
      updates['plan.one_off_consumido'] = true;
    }
    // Legacy (docs migrándose) · se elimina en limpieza futura.
    updates.fecha_ultima_generacion = now;
    updates.lastActive = now;

    // ── 11. Persistir (Admin SDK · bypassa rules) ──
    await ref.update(updates);

    logger.info('[generatePlan] OK', { uid, scope, reason: decision.reason });

    return {
      ok: true,
      scope,
      generatedMenu: wantMenu,
      generatedEntreno: wantEntreno,
      // No devolvemos el plan entero · el cliente recarga el doc tras esto.
    };
  },
);
