// Cap diario GLOBAL de generaciones IA · protección de presupuesto.
//
// POR QUÉ ESTO Y NO "desconectar billing si >5€/día":
//   - Desconectar billing tumba TODA la app (Firestore, Auth, Hosting) ·
//     opción nuclear · un falso positivo deja a todos los users fuera.
//   - El vector de coste real en Fase 6 es Gemini (cada generación = ~1
//     llamada). Un bucle runaway o un pico de abuso se frena limitando
//     las generaciones GLOBALES por día · cero riesgo para el resto de
//     la app, y ataca exactamente la fuente del gasto.
//
// Contador en /system/dailyQuota/{YYYY-MM-DD}. Se incrementa atómicamente
// por cada generación. Si supera GLOBAL_DAILY_CAP, generatePlan rechaza
// con 'unavailable' (capacidad) hasta el día siguiente. El doc del día se
// crea solo · los antiguos se pueden limpiar con TTL o ignorar (mínimos).
//
// CAP pre-launch conservador. Estimación de coste: gemini-2.5-flash-lite
// a ~1-2k tokens out/generación · ~500 generaciones/día está muy por
// debajo del budget de 5€/mes. Subir cuando crezca la base de usuarios.

import type { Firestore } from 'firebase-admin/firestore';

const GLOBAL_DAILY_CAP = 500;

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Incrementa el contador global del día de forma atómica y lanza si se
// supera el cap. Devuelve normalmente si hay cupo.
export async function enforceGlobalDailyCap(
  db: Firestore,
  now: number,
): Promise<void> {
  const ref = db.doc(`system/dailyQuota_${todayKey(now)}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    if (count >= GLOBAL_DAILY_CAP) {
      const err = new Error('global_cap_reached');
      err.name = 'GlobalCapError';
      throw err;
    }
    tx.set(ref, { count: count + 1, updatedAt: now }, { merge: true });
  });
}

export { GLOBAL_DAILY_CAP };
