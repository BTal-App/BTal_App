// cleanupExpiredGuests · scheduled (cada 24h).
//
// El TTL de Firestore borra automáticamente el doc /users/{uid} de los
// invitados a los 3 días (campo expiresAt), pero NO toca:
//   - la subcolección /users/{uid}/registros/{...} → queda huérfana
//   - el usuario anónimo de Firebase Auth → queda zombie
//
// Esta función cierra el ciclo: busca usuarios Auth anónimos cuyo doc
// Firestore ya NO existe (el TTL lo borró) y los elimina en cascada
// (subcolección + Auth user). Idempotente · si no hay nada que limpiar
// no hace writes.
//
// Reemplaza al script manual scripts/delete-guests.mjs para producción.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Margen de gracia: solo tocamos anónimos creados hace > 3 días + 1 día
// de colchón, para no pisar invitados recién creados cuyo doc aún vive.
const GRACE_MS = 4 * 24 * 60 * 60 * 1000;

export const cleanupExpiredGuests = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const auth = getAuth();
    const db = getFirestore();
    const now = Date.now();

    let deletedUsers = 0;
    let deletedRegistros = 0;
    let pageToken: string | undefined;

    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;

      for (const user of page.users) {
        // Anónimo = sin providers vinculados. Si tiene email/google/etc,
        // es cuenta real · NUNCA tocar.
        const isAnonymous = user.providerData.length === 0;
        if (!isAnonymous) continue;

        // Solo candidatos viejos (más allá del TTL + colchón).
        const created = Date.parse(user.metadata.creationTime);
        if (Number.isNaN(created) || now - created < GRACE_MS) continue;

        // Si el doc Firestore AÚN existe, el invitado sigue dentro de plazo
        // (o vinculó cuenta) · no tocar. Solo limpiamos huérfanos.
        const docRef = db.doc(`users/${user.uid}`);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        // Doc ya borrado por TTL → limpiar subcolección huérfana + Auth.
        try {
          const registros = await db.collection(`users/${user.uid}/registros`).get();
          if (!registros.empty) {
            const batch = db.batch();
            registros.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            deletedRegistros += registros.size;
          }
          await auth.deleteUser(user.uid);
          deletedUsers += 1;
        } catch (err) {
          logger.warn('[cleanupExpiredGuests] error limpiando', { uid: user.uid, err: String(err) });
        }
      }
    } while (pageToken);

    logger.info('[cleanupExpiredGuests] hecho', { deletedUsers, deletedRegistros });
  },
);
