import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

if (import.meta.env.DEV) {
  const missing = required.filter((k) => !import.meta.env[k]);
  if (missing.length) {
    console.warn(
      `[BTal] Faltan variables en .env: ${missing.join(', ')}. ` +
      `Auth y Firestore darán errores hasta que las añadas.`,
    );
  }
  if (!import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
    console.warn(
      '[BTal] Falta VITE_RECAPTCHA_ENTERPRISE_SITE_KEY en .env · ' +
      'App Check web no se activará. Crear el site key en ' +
      'https://console.cloud.google.com/security/recaptcha (tipo ' +
      '"Score-based" o "Checkbox") y registrarlo en Firebase Console ' +
      '> App Check > Apps > web app > reCAPTCHA Enterprise.',
    );
  }
}

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);

// ── App Check · Fase 11-0 · split web/native ────────────────────────────
// Defensa contra abuso de tu backend desde clientes NO oficiales (Postman,
// curl, scripts, headless browsers sin contexto). Cada llamada a Firebase
// (Auth, Firestore, Functions, Storage) lleva un token criptográfico que
// el servidor verifica antes de procesar. Sin token o token inválido →
// 403 a nivel de servicio · ni siquiera entra a las security rules.
//
// PROVIDERS POR PLATAFORMA
//   - Web (PWA / browser): reCAPTCHA Enterprise. Score-based, invisible
//     para el user, free tier 1M assessments/mes (vs 10K de Classic v3).
//     Mucho mejor scoring que Classic en Brave Shields / incógnito.
//   - Capacitor Android nativo: Play Integrity via plugin Capacitor. El
//     SO verifica que la app es una instalación legítima desde Play Store
//     (o build debug con SHA-256 registrado). Free 10K/día (300K/mes).
//   - Capacitor iOS nativo: DeviceCheck / App Attest via plugin Capacitor.
//     El SO verifica el dispositivo. Free unlimited.
//
// FLUJO EN NATIVO
//   El plugin @capacitor-firebase/app-check inicializa App Check nativo y
//   obtiene tokens de Play Integrity / DeviceCheck. Como el resto de la
//   app usa el SDK web de Firebase desde WebView, integramos el plugin
//   con el web SDK vía `CustomProvider`: cada vez que el web SDK necesita
//   un token, llama al plugin nativo que devuelve el token producido por
//   el SO. Lo mejor de los dos mundos.
//
// DEBUG TOKEN (DEV ONLY · ver bloque de codigo abajo)
//   En entornos donde reCAPTCHA o Play Integrity no se pueden obtener
//   (debug builds sin SHA registrado, emuladores Android sin Google Play,
//   navegadores con privacy extremo), activar VITE_APPCHECK_DEBUG=true
//   en .env. El SDK genera un UUID que se registra en Firebase Console
//   > App Check > Apps > Manage debug tokens.
//
// CONFIGURACIÓN EN FIREBASE CONSOLE
//   1. App Check > Apps > web app: añadir reCAPTCHA Enterprise site key
//   2. App Check > Apps > Android app: activar Play Integrity provider
//      (requiere SHA-256 del APK debug + release)
//   3. App Check > Apps > iOS app: activar DeviceCheck / App Attest
//      (cuando llegue iOS · requiere Bundle ID + Team ID)
const RECAPTCHA_ENTERPRISE_SITE_KEY = import.meta.env
  .VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;

let appCheck: AppCheck | null = null;
function bootstrapAppCheck(): void {
  if (typeof window === 'undefined') return; // SSR / vitest jsdom OK pero no hay window

  // Debug token mode (DEV ONLY) · activable via env var. Sirve cuando:
  //   - Capacitor Android sin SHA-256 registrado en Play Integrity
  //   - Emulador Android sin Google Play Services
  //   - Brave Shields / incógnito bloqueando reCAPTCHA Enterprise
  //   - iOS dev build sin DeviceCheck habilitado todavía
  // El SDK genera un UUID y lo imprime en console. Registrar UNA VEZ por
  // device en Firebase Console > App Check > Apps > tu app > Manage
  // debug tokens. Solo ese device pasa App Check con ese UUID.
  // CAUTION: si VITE_APPCHECK_DEBUG queda 'true' en build de producción,
  // App Check rechazará a TODOS los users reales con 403. Quitar antes
  // de cada release. La forma canónica en BTal es tenerla en .env.local
  // (gitignored) solo para dev y nunca en .env (que es el "release").
  // VITE_APPCHECK_DEBUG admite dos formas:
  //   - 'true'  → el SDK auto-genera un UUID y lo imprime en consola (hay
  //               que registrarlo en Console · CAMBIA en cada reinstalación).
  //   - <UUID>  → token debug FIJO · determinista, sobrevive a
  //               reinstalaciones · se registra UNA sola vez en Console para
  //               la app correspondiente (en Capacitor es la app **Web**,
  //               porque el SDK web es quien adjunta el token de App Check).
  // En NATIVO esto reemplaza al CustomProvider/Play Integrity para pruebas.
  const appCheckDebug = import.meta.env.VITE_APPCHECK_DEBUG as string | undefined;
  if (appCheckDebug && appCheckDebug !== 'false') {
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebug === 'true' ? true : appCheckDebug;
    if (import.meta.env.DEV) {
      console.info(
        '[BTal] App Check DEBUG mode activo' +
        (appCheckDebug === 'true' ? ' · el SDK imprimirá un UUID al inicializar.' : ' · token fijo.') +
        ' Regístralo en Firebase Console > App Check.',
      );
    }
  }

  if (Capacitor.isNativePlatform()) {
    // Native (Capacitor Android / iOS) · usa el plugin nativo via
    // CustomProvider. El plugin se encarga de Play Integrity (Android)
    // o DeviceCheck / App Attest (iOS) en el lado nativo, y nos da los
    // tokens vía API JS. El web SDK los inyecta en headers de Firebase.
    bootstrapAppCheckNative().catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[BTal] Native App Check init failed:', err);
      }
    });
    return;
  }

  // Web (PWA / browser) · reCAPTCHA Enterprise
  if (!RECAPTCHA_ENTERPRISE_SITE_KEY) {
    // En CI / build sin site key, App Check NO se inicializa · las llamadas
    // pasan sin token. En modo enforcement de Firebase Console, esas
    // llamadas fallarán 403. Esto es intencional · el dev tiene que tener
    // el debug token configurado o el site key real para que funcione.
    return;
  }
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      // isTokenAutoRefreshEnabled · App Check refresca el token antes de
      // que caduque (cada 30 min aprox). Sin esto las llamadas tras una
      // sesión larga (1h+) fallarían. Default true desde firebase@9.6+.
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // En HMR de Vite o doble init, initializeAppCheck lanza · lo tragamos
    // (el primer init sigue siendo válido). En producción nunca debería
    // ocurrir porque firebase.ts se importa una sola vez.
    if (import.meta.env.DEV) {
      console.warn('[BTal] App Check init failed:', err);
    }
  }
}

async function bootstrapAppCheckNative(): Promise<void> {
  const { FirebaseAppCheck } = await import('@capacitor-firebase/app-check');
  // Inicializar el plugin nativo. En Android se conecta automáticamente
  // a Play Integrity (gratis 10K/día); en iOS, a DeviceCheck / App Attest
  // (gratis unlimited). El provider concreto se configura en Firebase
  // Console > App Check > tu app · el SDK nativo lo lee al boot.
  // `isTokenAutoRefreshEnabled` (lado nativo) · refresca antes de caducar.
  // `debug` solo si la env var VITE_APPCHECK_DEBUG === 'true' · permite
  // a Firebase aceptar tokens de debug registrados manualmente en Console.
  await FirebaseAppCheck.initialize({
    isTokenAutoRefreshEnabled: true,
    debug: import.meta.env.VITE_APPCHECK_DEBUG === 'true',
  });

  try {
    appCheck = initializeAppCheck(app, {
      // CustomProvider: el web SDK pide token via callback async · nosotros
      // delegamos al plugin nativo que devuelve un token producido por el
      // SO (Play Integrity / DeviceCheck). El web SDK lo inyecta en los
      // headers `X-Firebase-AppCheck` de todas las llamadas a Firebase.
      provider: new CustomProvider({
        getToken: async () => {
          const result = await FirebaseAppCheck.getToken({
            forceRefresh: false,
          });
          return {
            token: result.token,
            // El plugin devuelve `expireTimeMillis` como string (epoch ms);
            // CustomProvider espera number. Parseamos.
            expireTimeMillis: Number(result.expireTimeMillis),
          };
        },
      }),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[BTal] App Check (native CustomProvider) init failed:', err);
    }
  }
}

bootstrapAppCheck();
// Re-exportamos por si alguna parte de la app necesita el handle (p.ej.
// para `getToken(appCheck)` manual en debugging). Hoy nadie lo usa.
export { appCheck };

// Persistencia explícita de la sesión:
//   1º indexedDBLocalPersistence — preferida; sobrevive al cierre del
//      navegador, a la recarga y a la reinstalación de la PWA. Más
//      fiable que localStorage en mobile (Safari iOS PWA standalone,
//      Chrome Android, Firefox Focus, etc.).
//   2º browserLocalPersistence — fallback robusto si IDB no está
//      disponible (modo privado en algunos navegadores, WebViews antiguos).
//
// Sin esta configuración, Firebase usaría sólo browserLocalPersistence
// por defecto, que en algunos contextos de PWA standalone se borra al
// cerrar la app.
//
// Usamos try/catch para soportar HMR de Vite: en el primer load
// initializeAuth funciona, en HMR re-evalúa el módulo y la segunda
// llamada lanza error porque ya hay un Auth registrado · entonces caemos
// a getAuth(app) que devuelve la instancia existente.
function bootstrapAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = bootstrapAuth();

// Firestore se carga bajo demanda (ver services/db.ts) para no inflar el
// bundle inicial. La Landing no lo necesita.
