import { initializeApp, type FirebaseOptions } from 'firebase/app';
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
