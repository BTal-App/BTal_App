// Firebase Analytics · Fase 13-2 (web pre-launch) + Fase 9 (native).
//
// FILOSOFÍA NATIVE-FIRST
//   - 99% de los users de BTal usarán la app nativa iOS/Android (Capacitor).
//   - En nativo: `@capacitor-firebase/analytics` + `@capacitor-firebase/crashlytics`
//     (Fase 9) usan IDFV/GAID — sin cookies, sin banner, sin prompt ATT
//     (porque no hacemos tracking cross-app · IDFV es app-scoped).
//   - En web/PWA (este archivo): `firebase/analytics` SDK web usa cookies
//     `_ga` + `_ga_<measurementId>` → necesita consentimiento GDPR.
//   - Init solo si el user acepta el banner. Sin consent → no-op silencioso.
//
// CONFIGURACIÓN
//   Firebase Console → Project Settings → tu Web App → "Measurement ID"
//   (G-XXXXXXXX). Si no aparece, hay que enablar Google Analytics en el
//   proyecto: Firebase Console → Analytics → Habilitar.
//   Luego en `.env`:
//     VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
//   El Measurement ID es PÚBLICO (va embebido en el bundle, mismo trato
//   que las otras VITE_FIREBASE_* keys).
//
// COSTE
//   Free forever, unlimited (parte del plan Blaze ya activo). 1M events
//   por user/día como hard cap teórico — imposible alcanzar pre-launch.
//
// EVENTOS QUE TRACKEAMOS (lista del roadmap 13-3)
//   - page_view              (automático, lo añade el SDK)
//   - signup_completed       custom · al finalizar onboarding
//   - onboarding_step        custom · cada paso (1-4)
//   - plan_generated         custom · IA generó plan (Fase 6)
//   - upgrade_to_pro         custom · click upgrade
//   - subscription_started   custom · webhook Stripe confirmó (Fase 7)
//   - subscription_cancelled custom · webhook Stripe (Fase 7)
//   - meal_edited            custom · save de MealSheet
//   - workout_logged         custom · save en RegistroPage
//   - mode_changed           custom · IA↔manual
//
// PII
//   NO enviamos: email, nombre, teléfono, peso/edad exactos.
//   SÍ enviamos: uid (Firebase user id · anónimo desde Analytics POV),
//   país, device type, OS, browser, screen, evento + parámetros enum.

import type { Analytics } from 'firebase/analytics';
import { app } from './firebase';
import {
  hasAnalyticsConsent,
  onConsentChange,
} from '../hooks/cookie-consent-store';

const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
  | string
  | undefined;

let analyticsInstance: Analytics | null = null;
let bootstrapPromise: Promise<void> | null = null;

/**
 * Inicializa Firebase Analytics SOLO si el user dio consentimiento.
 * El SDK se carga lazy via `import('firebase/analytics')` para no
 * inflar el bundle inicial · pesa ~30 KB.
 *
 * Idempotente · llamar las veces que quieras (HMR, cambios de consent).
 */
export async function bootstrapAnalytics(): Promise<void> {
  if (typeof window === 'undefined') return; // SSR / vitest
  if (analyticsInstance) return; // ya inicializado
  if (!MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.info(
        '[BTal] Firebase Analytics deshabilitado · falta ' +
        'VITE_FIREBASE_MEASUREMENT_ID. Firebase Console → Analytics → ' +
        'Habilitar · luego Project Settings → Web App → Measurement ID.',
      );
    }
    return;
  }
  if (!hasAnalyticsConsent()) {
    if (import.meta.env.DEV) {
      console.info('[BTal] Firebase Analytics esperando consentimiento.');
    }
    return;
  }
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      if (!(await isSupported())) {
        // Algunos navegadores (Firefox con privacy strict, WebViews sin
        // gtag, etc.) reportan no-supported. No es error · skip silencioso.
        return;
      }
      analyticsInstance = getAnalytics(app);
    } catch (err) {
      // No fatal · simplemente no medimos. La app sigue funcionando.
      if (import.meta.env.DEV) {
        console.warn('[BTal] Analytics init failed:', err);
      }
    } finally {
      bootstrapPromise = null;
    }
  })();
  return bootstrapPromise;
}

/**
 * Re-init / teardown automático cuando el user cambia su consent.
 * Llamar UNA VEZ al boot · mantiene la suscripción viva mientras la
 * app esté montada.
 */
export function subscribeAnalyticsToConsent(): () => void {
  return onConsentChange((accepted) => {
    if (accepted) {
      void bootstrapAnalytics();
    } else {
      // Si el user revoca tras haber aceptado, idealmente tendríamos
      // que llamar a `setAnalyticsCollectionEnabled(false)`. Pero más
      // simple y robusto: reload la página · al volver el SDK no se
      // inicializa (no hay consent). Lo gestiona el componente Settings.
      analyticsInstance = null;
    }
  });
}

/**
 * Track de evento custom · no-op silencioso si Analytics no está activo
 * (no consent, no measurement ID, navegador no soportado, etc.).
 */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (!analyticsInstance) return;
  // Importamos `logEvent` lazy para no forzar la carga si no hay instance.
  void (async () => {
    try {
      const { logEvent } = await import('firebase/analytics');
      logEvent(analyticsInstance!, name, params);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[BTal] trackEvent failed:', err);
      }
    }
  })();
}

/**
 * Asociar UID al user · llama tras login y tras refresh de identidad.
 * `setUserId` en Firebase Analytics es opaco desde el servidor (no se
 * cruza con PII) · sirve para correlacionar sesiones del mismo user.
 */
export function setAnalyticsUser(
  uid: string | null,
  properties?: Record<string, string>,
): void {
  if (!analyticsInstance) return;
  void (async () => {
    try {
      const { setUserId, setUserProperties } = await import('firebase/analytics');
      setUserId(analyticsInstance!, uid);
      if (properties && Object.keys(properties).length > 0) {
        setUserProperties(analyticsInstance!, properties);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[BTal] setAnalyticsUser failed:', err);
      }
    }
  })();
}
