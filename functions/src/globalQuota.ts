// Cap diario GLOBAL de generaciones IA · FRENO DE EMERGENCIA, no un
// límite para usuarios normales.
//
// PROPÓSITO: cortar SOLO un runaway catastrófico (un bug que genere en
// bucle, un ataque) antes de que dispare la factura de Gemini. NO debe
// bloquear nunca a usuarios legítimos · por eso el default es ALTO.
//
// POR QUÉ NO desconectar billing: tumbaría toda la app. Limitar las
// generaciones globales ataca directamente la fuente del gasto (Gemini)
// sin afectar Firestore/Auth/Hosting.
//
// CONFIGURABLE SIN REDEPLOY: el cap se lee de Firestore /system/config
// campo `dailyGenCap`. Si no existe, usa DEFAULT_DAILY_CAP. Así, al
// crecer la base de usuarios, se sube el número desde Firestore Console
// (Console > Firestore > system > config > dailyGenCap) sin tocar código.
//
// DIMENSIONAR: a ~€0,004/generación, el techo × €0,004 = gasto máximo
// diario de Gemini SI se llegara al tope. Default 20.000 → ~€80/día tope
// absoluto (solo en caso de runaway real). El uso normal queda MUY por
// debajo: incluso 10.000 DAU generan ~300-500/día (Free = 1/mes/usuario,
// repartido), así que 20.000 da >40x de margen. Cuando la base crezca de
// verdad, subir el número en Firestore.

import type { Firestore } from 'firebase-admin/firestore';

// Techo alto por defecto · NO es un límite por-usuario (eso lo da el
// rate-limit 10/h + el Free 1/mes). Es el freno de emergencia global.
const DEFAULT_DAILY_CAP = 20000;

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Lee el cap configurable de /system/config.dailyGenCap (default 20000).
async function readDailyCap(db: Firestore): Promise<number> {
  try {
    const snap = await db.doc('system/config').get();
    const v = snap.exists ? (snap.data()?.dailyGenCap as unknown) : undefined;
    return typeof v === 'number' && v > 0 ? v : DEFAULT_DAILY_CAP;
  } catch {
    return DEFAULT_DAILY_CAP;
  }
}

// Incrementa el contador global del día de forma atómica y lanza SOLO si
// se supera el techo de emergencia. Devuelve normalmente en uso normal.
export async function enforceGlobalDailyCap(
  db: Firestore,
  now: number,
): Promise<void> {
  const cap = await readDailyCap(db);
  const ref = db.doc(`system/dailyQuota_${todayKey(now)}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    if (count >= cap) {
      const err = new Error('global_cap_reached');
      err.name = 'GlobalCapError';
      throw err;
    }
    tx.set(ref, { count: count + 1, updatedAt: now }, { merge: true });
  });
}
