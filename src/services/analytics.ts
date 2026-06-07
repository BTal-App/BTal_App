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
// SPLIT NATIVE / WEB
//   `Capacitor.isNativePlatform()` detecta runtime síncronamente:
//   - true (iOS Capacitor / Android Capacitor): usamos los plugins nativos.
//     Bootstrap inmediato (no esperamos consent · el SO ya tiene los settings
//     de privacidad del user). google-services.json en android/app/ +
//     GoogleService-Info.plist en ios/App/App/ se encargan del Measurement ID.
//   - false (browser PWA): seguimos con el SDK web + consent banner.
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
//   En nativo NO se usa esa env · el SDK lee el measurementId de
//   google-services.json (Android) y GoogleService-Info.plist (iOS). Esos
//   archivos los genera Firebase Console al añadir la app Android/iOS al
//   proyecto y se ubican como recursos nativos del proyecto Capacitor.
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
//   - subscription_started   custom · webhook RevenueCat (IAP) confirmó
//   - subscription_cancelled custom · webhook RevenueCat (IAP)
//   - meal_edited            custom · save de MealSheet
//   - workout_logged         custom · save en RegistroPage
//   - mode_changed           custom · IA↔manual
//
// PII
//   NO enviamos: email, nombre, teléfono, peso/edad exactos.
//   SÍ enviamos: uid (Firebase user id · anónimo desde Analytics POV),
//   país, device type, OS, browser, screen, evento + parámetros enum.

import type { Analytics } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { app } from './firebase';
import {
  hasAnalyticsConsent,
  onConsentChange,
} from '../hooks/cookie-consent-store';

const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
  | string
  | undefined;

// Runtime detection · síncrono. `Capacitor.isNativePlatform()` devuelve
// true en iOS/Android Capacitor, false en browser (incluyendo Capacitor
// `web` platform que en realidad es el browser embebido en dev).
const IS_NATIVE = Capacitor.isNativePlatform();

// ── WEB (PWA) state ─────────────────────────────────────────────────────
let analyticsInstance: Analytics | null = null;
let bootstrapPromise: Promise<void> | null = null;

// Cola del último setAnalyticsUser disparado antes de que el SDK esté
// listo · típicamente onAuthStateChanged fires con el user persistido
// inmediatamente al cargar, mientras bootstrapAnalytics aún está en su
// `await import('firebase/analytics')` async. Sin esta cola, el primer
// page_view del SDK (que sale en cuanto getAnalytics() resuelve) se
// atribuiría a "anónimo" porque setUserId no llegó a tiempo. Guardamos
// la última llamada y la reproducimos al final de bootstrap.
let pendingUid: string | null | undefined = undefined; // undefined = no hay pending
let pendingProperties: Record<string, string> | undefined;

// ── NATIVE state ────────────────────────────────────────────────────────
// El plugin Capacitor mantiene la instancia en el lado nativo · aquí solo
// trackeamos si ya enabled-amos analytics para no llamar setEnabled dos veces.
let nativeReady = false;

/**
 * Inicializa Firebase Analytics.
 *
 * - **Native (iOS/Android)**: arranca inmediato sin consent UI. Los SO
 *   tienen sus propios controles de privacidad (Settings → Tracking en
 *   iOS, Datos personales en Android). El plugin lee config del
 *   `google-services.json` / `GoogleService-Info.plist`.
 * - **Web (PWA)**: solo si el user dio consentimiento. SDK lazy via
 *   `import('firebase/analytics')` para no inflar el bundle inicial
 *   (~30 KB ahorrados si el user no acepta).
 *
 * Idempotente · llamar las veces que quieras (HMR, cambios de consent).
 */
export async function bootstrapAnalytics(): Promise<void> {
  if (typeof window === 'undefined') return; // SSR / vitest

  if (IS_NATIVE) {
    if (nativeReady) return;
    try {
      const { FirebaseAnalytics } = await import(
        '@capacitor-firebase/analytics'
      );
      const { FirebaseCrashlytics } = await import(
        '@capacitor-firebase/crashlytics'
      );
      await FirebaseAnalytics.setEnabled({ enabled: true });
      await FirebaseCrashlytics.setEnabled({ enabled: true });
      nativeReady = true;
      // Replay del pendingUid si llegó antes de que el plugin estuviera ready.
      if (pendingUid !== undefined) {
        const uidToFlush = pendingUid;
        const propsToFlush = pendingProperties;
        pendingUid = undefined;
        pendingProperties = undefined;
        setAnalyticsUser(uidToFlush, propsToFlush);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[BTal] Native analytics init failed:', err);
      }
    }
    return;
  }

  // ── WEB path ──
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
      // Replay del último setAnalyticsUser que se intentó antes de
      // que el SDK estuviera listo. Sin esto, el page_view inicial
      // se atribuiría a usuario anónimo aunque hubiera un UID conocido.
      if (pendingUid !== undefined) {
        const uidToFlush = pendingUid;
        const propsToFlush = pendingProperties;
        pendingUid = undefined;
        pendingProperties = undefined;
        setAnalyticsUser(uidToFlush, propsToFlush);
      }
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
 *
 * No-op en nativo · ahí el control de privacidad lo gestiona el SO
 * (no usamos cookies en plataforma nativa).
 */
export function subscribeAnalyticsToConsent(): () => void {
  if (IS_NATIVE) return () => {};
  return onConsentChange((accepted) => {
    if (accepted) {
      void bootstrapAnalytics();
    } else {
      // Si el user revoca tras haber aceptado, idealmente tendríamos
      // que llamar a `setAnalyticsCollectionEnabled(false)`. Pero más
      // simple y robusto: reload la página · al volver el SDK no se
      // inicializa (no hay consent). Lo gestiona el componente Settings.
      analyticsInstance = null;
      pendingUid = undefined;
      pendingProperties = undefined;
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
  if (IS_NATIVE) {
    if (!nativeReady) return;
    void (async () => {
      try {
        const { FirebaseAnalytics } = await import(
          '@capacitor-firebase/analytics'
        );
        // El plugin requiere `params` como objeto plano · undefined no se
        // serializa bien a través del bridge nativo · filtramos.
        const cleanParams: Record<string, string | number | boolean> = {};
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            if (v !== undefined) cleanParams[k] = v;
          }
        }
        await FirebaseAnalytics.logEvent({ name, params: cleanParams });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[BTal] trackEvent (native) failed:', err);
        }
      }
    })();
    return;
  }

  // ── WEB path ──
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
 *
 * Además del UID setea Crashlytics user id en nativo · cuando un crash
 * llega a Firebase Console aparece etiquetado con el UID y podemos
 * correlacionar con el doc Firestore del user para reproducir.
 */
export function setAnalyticsUser(
  uid: string | null,
  properties?: Record<string, string>,
): void {
  if (IS_NATIVE) {
    if (!nativeReady) {
      pendingUid = uid;
      pendingProperties = properties;
      return;
    }
    void (async () => {
      try {
        const { FirebaseAnalytics } = await import(
          '@capacitor-firebase/analytics'
        );
        const { FirebaseCrashlytics } = await import(
          '@capacitor-firebase/crashlytics'
        );
        await FirebaseAnalytics.setUserId({ userId: uid });
        if (uid) {
          // Crashlytics solo acepta string (no null) en setUserId · si
          // hacemos logout, no hay forma de "limpiar" el user id sin
          // crashear el SDK. Lo dejamos persistido hasta el próximo login.
          await FirebaseCrashlytics.setUserId({ userId: uid });
        }
        if (properties) {
          for (const [key, value] of Object.entries(properties)) {
            await FirebaseAnalytics.setUserProperty({ key, value });
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[BTal] setAnalyticsUser (native) failed:', err);
        }
      }
    })();
    return;
  }

  // ── WEB path ──
  if (!analyticsInstance) {
    // SDK aún no listo (bootstrap async en curso o esperando consent).
    // Guardamos la última llamada para reproducirla cuando inicialice.
    pendingUid = uid;
    pendingProperties = properties;
    return;
  }
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
