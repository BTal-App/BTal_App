// deleteAccount · Cloud Function callable · borrado RGPD COMPLETO.
//
// El borrado client-side (fbDeleteUser) solo eliminaba el usuario de Auth
// y dejaba HUÉRFANOS el doc /users/{uid} y la subcolección /registros.
// Esta función borra TODO en cascada con Admin SDK:
//   1. /users/{uid} + todas sus subcolecciones (recursiveDelete · cubre
//      /registros y cualquier futura subcolección) → dato Firestore fuera.
//   2. El usuario de Firebase Auth (admin.auth().deleteUser).
//
// SEGURIDAD: requiere auth + App Check + login RECIENTE (auth_time < 5 min).
// Si la sesión es vieja, devuelve 'requires-recent-login' · el cliente
// hace reauth y reintenta (misma UX que antes). Evita que una sesión
// robada/olvidada borre la cuenta.
//
// Stripe (cancelar suscripción antes de borrar) → se añadirá en Fase 7.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const REAUTH_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

export const deleteAccount = onCall(
  {
    enforceAppCheck: true,
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const uid = request.auth.uid;

    // Login reciente · auth_time viene en segundos epoch.
    const authTimeSec = request.auth.token.auth_time as number | undefined;
    const authTimeMs = authTimeSec ? authTimeSec * 1000 : 0;
    if (!authTimeMs || Date.now() - authTimeMs > REAUTH_MAX_AGE_MS) {
      throw new HttpsError('failed-precondition', 'requires-recent-login');
    }

    const db = getFirestore();
    try {
      // 1. Borra el doc del user + TODAS sus subcolecciones (/registros, etc.).
      await db.recursiveDelete(db.doc(`users/${uid}`));
      // 2. Borra el usuario de Firebase Auth.
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.error('[deleteAccount] fallo borrando', { uid, err: String(err) });
      throw new HttpsError('internal', 'No se ha podido eliminar la cuenta. Inténtalo de nuevo.');
    }

    logger.info('[deleteAccount] cuenta eliminada completa', { uid });
    return { ok: true };
  },
);
