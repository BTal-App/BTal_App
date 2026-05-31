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

import type { AiScopeChoice, GeneracionesIA, UserDocument } from './types.js';
import { profileSchema, geminiResponseSchema } from './schemas.js';
import { buildPrompt, buildSystemInstruction } from './prompt.js';
import { callGemini } from './gemini.js';
import { checkEligibility, maybeResetCycle, type EligibilityDecision } from './eligibility.js';
import { enforceRateLimit } from './rateLimit.js';
import { enforceGlobalDailyCap } from './globalQuota.js';
import {
  mapAllBuiltInPlans,
  mapMenu,
  mapSuplementosDias,
  reconcileMealMacros,
} from './persist.js';
import { deriveShoppingList } from './shoppingList.js';
import { resolveMenuMacros } from './nutrition/resolve.js';
import { enrichAndAdjustMenu } from './nutrition/enrichMenu.js';

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

    // ── 5. Validación server-side del perfil (roadmap 6-7) · ANTES de
    // reservar el slot, para que un perfil inválido no consuma cuota. ──
    const parsedProfile = profileSchema.safeParse(userDoc.profile);
    if (!parsedProfile.success) {
      logger.warn('[generatePlan] perfil inválido', { uid, issues: parsedProfile.error.issues });
      throw new HttpsError(
        'failed-precondition',
        'Tu perfil tiene datos incompletos o fuera de rango. Revísalo en Ajustes.',
      );
    }
    const profile = parsedProfile.data;

    // ── 6. RESERVAR el slot de generación atómicamente (cierra la race
    // TOCTOU). En una transacción: re-lee, comprueba elegibilidad y, si
    // procede, INCREMENTA consumidas_ciclo (+ reset de ciclo / one_off
    // consumido) ANTES de llamar a Gemini. Dos requests concurrentes del
    // mismo user Free serializan aquí: el 2º ve consumidas ya incrementado
    // y se bloquea con limit_reached. Si Gemini/Zod fallan luego, hacemos
    // REFUND (más abajo) para no cobrarle la generación al user. ──
    let decision: EligibilityDecision;
    let genBefore: GeneracionesIA; // estado previo (para refund)
    let oneOffBefore: boolean;
    try {
      const reserved = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) {
          throw new HttpsError('failed-precondition', 'Perfil no encontrado. Completa el onboarding.');
        }
        const doc = s.data() as UserDocument;
        const { reset, next } = maybeResetCycle(doc.generaciones, now);
        const dec = checkEligibility(doc.plan, next, now);
        if (!dec.allowed) {
          const e = new Error('limit_reached') as Error & { unlocksAt?: number };
          e.name = 'EligibilityBlocked';
          e.unlocksAt = dec.unlocksAt;
          throw e;
        }
        const genReserve: GeneracionesIA = {
          ...next,
          consumidas_ciclo: next.consumidas_ciclo + 1,
        };
        if (reset) genReserve.ciclo_inicio = now;
        const upd: Record<string, unknown> = { generaciones: genReserve };
        if (dec.reason === 'one_off' && dec.consumeOneOff) {
          upd['plan.one_off_consumido'] = true;
        }
        tx.update(ref, upd);
        return { dec, genPrev: next, oneOffPrev: doc.plan.one_off_consumido ?? false };
      });
      decision = reserved.dec;
      genBefore = reserved.genPrev;
      oneOffBefore = reserved.oneOffPrev;
    } catch (err) {
      if ((err as Error).name === 'EligibilityBlocked') {
        throw new HttpsError('resource-exhausted', 'limit_reached', {
          unlocksAt: (err as Error & { unlocksAt?: number }).unlocksAt,
        });
      }
      throw err;
    }

    // REFUND · revierte la reserva si la generación no llega a persistirse
    // (Gemini caído / JSON inválido / cap global). Tras una reserva exitosa
    // ningún otro request del mismo user puede colarse (consumidas ya
    // bloquea), así que restaurar el `generaciones` previo es seguro.
    const refundReservation = async () => {
      try {
        await ref.update({
          generaciones: genBefore,
          'plan.one_off_consumido': oneOffBefore,
        });
      } catch (e) {
        logger.error('[generatePlan] refund falló', { uid, err: String(e) });
      }
    };

    // ── 6b. Cap diario global (freno de presupuesto) · DESPUÉS de reservar
    // para que solo cuente generaciones reales (un user bloqueado ni llega
    // aquí). Si se supera el techo, refund + fuera. ──
    try {
      await enforceGlobalDailyCap(db, now);
    } catch (err) {
      if ((err as Error).name === 'GlobalCapError') {
        await refundReservation();
        throw new HttpsError(
          'unavailable',
          'Estamos recibiendo muchas solicitudes ahora mismo. Inténtalo de nuevo más tarde.',
        );
      }
      await refundReservation();
      throw err;
    }

    // ── 7. Prompt + Gemini ──
    const { wantMenu, wantEntreno, deriveCompra } = scopeParts(scope);
    // Top récords del usuario (solo si genera entreno y ya tiene historial) ·
    // se inyectan en el prompt para progresiones realistas. Vacío en la 1ª
    // generación (sin entrenos registrados todavía).
    const topPRs = wantEntreno
      ? Object.entries(userDoc.registroStats?.prs ?? {})
          .map(([exercise, pr]) => ({ exercise, kg: pr?.kg ?? 0 }))
          .filter((r) => r.kg > 0)
          .sort((a, b) => b.kg - a.kg)
          .slice(0, 8)
      : [];
    // Referencia (ajustable) de lo que aporta el batido al total del día · la
    // IA la usa para cuadrar el menú y puede proponer otra. Viene del doc del
    // user (default de la app para uno nuevo) · NO es un valor fijo.
    const bc = userDoc.suplementos?.batidoConfig;
    const batidoRef = wantMenu
      ? {
          grProt: bc?.gr_prot ?? 35,
          kcal: bc?.kcal ?? 145,
          prot: bc?.prot ?? 30,
          carb: bc?.carb ?? 4,
          fat: bc?.fat ?? 1,
        }
      : undefined;
    const prompt = buildPrompt(profile, { scope, wantMenu, wantEntreno, topPRs, batidoRef });
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
      await refundReservation();
      throw new HttpsError('unavailable', 'La IA no está disponible ahora mismo. Inténtalo en unos minutos.');
    }

    // ── 8. Validar JSON de Gemini (roadmap 6-8) ──
    let parsed;
    try {
      parsed = geminiResponseSchema.parse(JSON.parse(rawJson));
    } catch (err) {
      logger.error('[generatePlan] respuesta IA inválida', { uid, scope, err: String(err) });
      await refundReservation();
      throw new HttpsError('internal', 'La IA devolvió una respuesta inesperada. Vuelve a intentarlo.');
    }
    if (wantMenu && !parsed.menu) {
      await refundReservation();
      throw new HttpsError('internal', 'La IA no generó el menú. Vuelve a intentarlo.');
    }
    if (wantEntreno && !parsed.entrenos) {
      await refundReservation();
      throw new HttpsError('internal', 'La IA no generó los planes de entreno. Vuelve a intentarlo.');
    }

    // ── 9. Mapear a Firestore aplicando contratos ──
    const updates: Record<string, unknown> = {};

    // Suplementos mapeados UNA vez · los reusan el ajuste del menú (para contar
    // el batido en el total del día) y los updates de más abajo. La IA
    // recomienda días de batido/creatina, el check includeCreatina y, si lo ve,
    // las macros del batido.
    const supDias = parsed.suplementos ? mapSuplementosDias(parsed.suplementos) : null;

    if (wantMenu && parsed.menu) {
      const base = reconcileMealMacros(mapMenu(parsed.menu, userDoc.menu, !allowUserItems));
      // Fase 6B: macros REALES desde el cache OFF (foods/) + ajuste de gramos
      // para que cada día alcance el objetivo de kcal. Lee SOLO Firestore (sin
      // llamar a la API de OFF en caliente). Lo no cacheado conserva la
      // estimación de la IA (no rompe · solo no se ajusta tan fino).
      const macrosMap = await resolveMenuMacros(db, base);
      const batidoInfo =
        supDias && supDias.daysWithBatido.length > 0
          ? {
              days: supDias.daysWithBatido,
              kcal: supDias.batidoMacros?.kcal ?? userDoc.suplementos?.batidoConfig?.kcal ?? 145,
            }
          : undefined;
      const menu = enrichAndAdjustMenu(base, profile, macrosMap, batidoInfo);
      updates.menu = menu;
      if (deriveCompra) {
        updates.compra = deriveShoppingList(userDoc.compra, menu, 'ai');
      }
    }

    if (wantEntreno && parsed.entrenos) {
      // Rellena los 7 planes builtin · activo = el que coincide con diasEntreno.
      updates.entrenos = mapAllBuiltInPlans(userDoc.entrenos, parsed.entrenos, profile.diasEntreno);
    }

    // Suplementos · escribe días/flags con dot-path para preservar config,
    // stock y contadores del user. Sustituye al error de meter batidos como
    // comidas del menú.
    if (supDias) {
      updates['suplementos.daysWithBatido'] = supDias.daysWithBatido;
      updates['suplementos.daysWithCreatina'] = supDias.daysWithCreatina;
      updates['suplementos.batidoConfig.includeCreatina'] = supDias.includeCreatina;
      // Macros del batido · solo si la IA las propuso. Si no, conserva la del user.
      if (supDias.batidoMacros) {
        updates['suplementos.batidoConfig.gr_prot'] = supDias.batidoMacros.gr_prot;
        updates['suplementos.batidoConfig.kcal'] = supDias.batidoMacros.kcal;
        updates['suplementos.batidoConfig.prot'] = supDias.batidoMacros.prot;
        updates['suplementos.batidoConfig.carb'] = supDias.batidoMacros.carb;
        updates['suplementos.batidoConfig.fat'] = supDias.batidoMacros.fat;
      }
    }

    // ── 10. Timestamps de generación · la CUOTA ya se reservó en la
    // sección 6. Escribimos menu_at/entrenos_at con dot-path para NO pisar
    // el consumidas_ciclo / ciclo_inicio ya reservados. ──
    if (wantMenu) updates['generaciones.menu_at'] = now;
    if (wantEntreno) updates['generaciones.entrenos_at'] = now;
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
