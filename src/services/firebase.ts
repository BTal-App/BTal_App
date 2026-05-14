import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

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
  if (!import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY) {
    console.warn(
      '[BTal] Falta VITE_RECAPTCHA_V3_SITE_KEY en .env · App Check no '
      + 'se activará. En dev usa `self.FIREBASE_APPCHECK_DEBUG_TOKEN = '
      + 'true` antes del primer import de Firebase para que App Check '
      + 'imprima un token de debug en consola que puedes añadir desde '
      + 'Firebase Console > App Check > Apps > ... > Manage debug tokens.',
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
};

export const app = initializeApp(firebaseConfig);

// ── App Check · Fase 11-0 ──────────────────────────────────────────────
// Defensa contra abuso de tu backend desde clientes NO oficiales (Postman,
// curl, scripts, headless browsers sin contexto). Cada llamada a Firebase
// (Auth, Firestore, Functions, Storage) lleva un token criptográfico
// generado por reCAPTCHA v3 que el servidor verifica antes de procesar.
// Sin token o token inválido → 403 a nivel de servicio · ni siquiera entra
// a las security rules.
//
// reCAPTCHA v3 es invisible para el user · puntúa cada request 0-1 según
// señales del navegador. Firebase Auth con reCAPTCHA Enterprise (toggle en
// Console > Authentication > Settings) hace el challenge VISIBLE solo en
// flujos sensibles (signup, recover password) cuando el score baja del
// umbral configurado.
//
// El init es síncrono pero `getToken()` es async · App Check intercepta
// las llamadas de los SDK de Firebase y añade el header automáticamente.
//
// En dev local sin site key, usamos debug provider:
//   - Antes de `import './firebase'`, en main.tsx o en consola del browser:
//     `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`
//   - El SDK imprime un debug token en consola la primera vez
//   - Copia ese token a Firebase Console > App Check > Apps > web app
//     > ⋮ > Manage debug tokens > Add debug token
//   - A partir de ahí, las llamadas desde tu dev pasan App Check sin
//     site key real
const RECAPTCHA_V3_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY as
  | string
  | undefined;

let appCheck: AppCheck | null = null;
function bootstrapAppCheck(): void {
  if (typeof window === 'undefined') return; // SSR / vitest jsdom OK pero no hay window
  if (!RECAPTCHA_V3_SITE_KEY) {
    // En CI / build sin site key, App Check NO se inicializa · las llamadas
    // pasan sin token. En modo enforcement de Firebase Console, esas
    // llamadas fallarán 403. Esto es intencional · el dev tiene que tener
    // el debug token configurado o el site key real para que funcione.
    return;
  }
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
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
