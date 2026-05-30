// revokeOtherSessions · Cloud Function callable.
//
// "Cerrar sesión en otros dispositivos" manteniendo ESTE. Firebase no tiene
// revocación selectiva: `revokeRefreshTokens(uid)` invalida TODOS los refresh
// tokens del user (incluido el de este dispositivo). Para no cerrarnos a
// nosotros mismos, tras revocar acuñamos un custom token y lo devolvemos · el
// cliente hace `signInWithCustomToken` y obtiene un refresh token NUEVO
// (emitido después de la revocación) que sobrevive, mientras los del resto de
// dispositivos quedan muertos y se cierran en su próximo refresh.
//
// SEGURIDAD: requiere auth + App Check. Bloquea invitados (una sola sesión).
// `createCustomToken` necesita que el SA de runtime tenga el rol
// "Service Account Token Creator" sobre sí mismo (concedido vía gcloud).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';

export const revokeOtherSessions = onCall(
  {
    enforceAppCheck: true,
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const uid = request.auth.uid;
    if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('failed-precondition', 'No disponible para invitados.');
    }

    const auth = getAuth();
    try {
      // 1. Revoca TODOS los refresh tokens (incluido el de este dispositivo).
      await auth.revokeRefreshTokens(uid);
      // 2. Custom token para que ESTE dispositivo re-establezca su sesión con
      //    un refresh token nuevo · sin esto el user se cerraría a sí mismo.
      const token = await auth.createCustomToken(uid);
      logger.info('[revokeOtherSessions] OK', { uid });
      return { token };
    } catch (err) {
      logger.error('[revokeOtherSessions] fallo', { uid, err: String(err) });
      throw new HttpsError(
        'internal',
        'No se ha podido cerrar las otras sesiones. Inténtalo de nuevo.',
      );
    }
  },
);
