// Rate limiting por UID (roadmap 6-9) · anti-abuso.
//
// Aunque haya límite de ciclo (Free 1/mes), un user Pro podría pulsar
// "Generar" en bucle y disparar coste Gemini + carga. Limitamos a N
// generaciones por hora y por UID con un contador en Firestore en
// /users/{uid}/_meta/rate. Ventana deslizante simple (resetea cada hora).
//
// Usa transacción para evitar carrera si el user dispara doble request.

import type { Firestore } from 'firebase-admin/firestore';

const MAX_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

interface RateDoc {
  count: number;
  windowStart: number;
}

// Lanza si se supera el límite · devuelve normalmente si hay cupo.
// Incrementa el contador de forma atómica.
export async function enforceRateLimit(
  db: Firestore,
  uid: string,
  now: number,
): Promise<void> {
  const ref = db.doc(`users/${uid}/_meta/rate`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as RateDoc) : undefined;

    if (!data || now - data.windowStart > WINDOW_MS) {
      // Ventana nueva o expirada · arranca de cero.
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if (data.count >= MAX_PER_HOUR) {
      const err = new Error('rate_limited');
      err.name = 'RateLimitError';
      throw err;
    }
    tx.update(ref, { count: data.count + 1 });
  });
}
