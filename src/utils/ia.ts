// Reglas de elegibilidad para generaciones IA.
//
// Lógica pura · no toca Firestore. Toma un `UserDocument` y decide si el
// usuario puede pulsar el botón "Generar con IA" en este momento. La UI
// (HoyPage, MenuPage, etc.) usa este helper para mostrar/ocultar/desactivar
// botones de regeneración. La Cloud Function `generatePlan` aplica la
// MISMA regla en el backend (la verdad está en el servidor) — esto solo
// es para UX: evitar que el botón se active si va a fallar.

import type { UserDocument } from '../templates/defaultUser';

// Suma 30 días calendario a una fecha · maneja correctamente cambios de
// horario (DST) porque `setDate` opera sobre la representación local de
// la fecha, no sobre milisegundos planos. Si sumas 30 * 86400 * 1000 a
// un epoch que cruza el cambio EU de octubre, te queda 1h descuadrado.
function addTreintaDias(ms: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + 30);
  return d.getTime();
}

export type CanGenerateReason =
  | 'guest' // sesión anónima · no aplica
  | 'manual_mode' // user eligió modo manual
  | 'limit_reached' // Free + ya consumió la gen del mes
  | 'ok_free' // Free + tiene su gen del mes disponible
  | 'ok_one_off' // Pago único activo, gen extra disponible
  | 'ok_pro'; // Pro activo, ilimitado

export interface CanGenerateResult {
  // ¿Puede el user pulsar "Generar con IA" ahora mismo?
  allowed: boolean;
  reason: CanGenerateReason;
  // Si está bloqueado por límite Free · ms epoch en que se desbloquea.
  unlocksAt?: number;
  // Texto sugerido para mostrar bajo el botón (UI).
  hint?: string;
}

// Decide si el usuario puede generar el plan ahora mismo. El límite del
// plan Free es GLOBAL (1 generación al mes total, sea total o parcial),
// así que no necesitamos saber el scope para decidir — la elección de
// scope la captura el AiGenerateModal por separado y se la pasa a la
// Cloud Function al momento de invocar `generatePlan`.
export function canGenerateAi(
  userDoc: UserDocument | null,
  isAnonymous: boolean,
): CanGenerateResult {
  if (isAnonymous) {
    return {
      allowed: false,
      reason: 'guest',
      hint: 'Crea una cuenta para usar la IA',
    };
  }
  if (!userDoc) {
    return { allowed: false, reason: 'manual_mode' };
  }
  if (userDoc.profile.modo !== 'ai') {
    return {
      allowed: false,
      reason: 'manual_mode',
      hint: 'Cambia a "Modo IA" en Ajustes → Administrar cuenta → Modo de generación para generar tu plan.',
    };
  }

  const now = Date.now();
  const plan = userDoc.plan;

  // Pro activo: ilimitado.
  if (plan.tipo === 'pro' && plan.vence_en !== null && plan.vence_en > now) {
    return { allowed: true, reason: 'ok_pro' };
  }

  // Pago único: 1 gen extra disponible si no se ha consumido.
  if (
    plan.tipo === 'one_off'
    && !plan.one_off_consumido
    && plan.vence_en !== null
    && plan.vence_en > now
  ) {
    return {
      allowed: true,
      reason: 'ok_one_off',
      hint: 'Regeneración inmediata disponible.',
    };
  }

  // Free: 1 gen al mes (opción 1 estricta — sea total o parcial cuenta igual).
  // Ciclo lo gestiona la Cloud Function. El cliente solo lee.
  const consumidas = userDoc.generaciones.consumidas_ciclo;
  const unlocksAt = addTreintaDias(userDoc.generaciones.ciclo_inicio);
  // Disponible si no ha consumido, O si el ciclo de 30 días ya venció: en
  // ese caso el servidor reseteará `consumidas_ciclo` en el próximo intento
  // (`maybeResetCycle`), así que la gen procede. Sin este `now >= unlocksAt`
  // el cliente seguiría mostrando "bloqueado" tras vencer el plazo aunque
  // ya pudiera generar — y la cuenta atrás de HoyPage nunca volvería a verde.
  if (consumidas === 0 || now >= unlocksAt) {
    return { allowed: true, reason: 'ok_free' };
  }

  // Bloqueado · ya gastó la gen del mes y el ciclo sigue vigente.
  return {
    allowed: false,
    reason: 'limit_reached',
    unlocksAt,
    hint:
      `Disponible el ${formatFecha(unlocksAt)}. ` +
      'Paga 4,99 € para desbloquear la regeneración inmediata o pásate a Pro para regenerar sin límites durante un mes.',
  };
}

function formatFecha(ms: number): string {
  const d = new Date(ms);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

// Fecha completa de desbloqueo · "29 de junio de 2026". La usa Ajustes
// (AccountManageModal) para mostrar cuándo vuelve la generación gratuita.
export function formatUnlockDate(ms: number): string {
  return formatFecha(ms);
}

// Cuenta atrás compacta hasta `targetMs` con DÍAS + horas (y horas+minutos
// el último día, minutos la última hora). Para el chip de HoyPage · el
// caller la refresca con un tick periódico (pásale su `now` bucketizado).
// Devuelve '' si ya venció (en ese caso el chip debería estar en verde).
export function formatCountdown(targetMs: number, now: number = Date.now()): string {
  const diff = targetMs - now;
  if (diff <= 0) return '';
  const totalMin = Math.floor(diff / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days >= 1) return `${days} d ${hours} h`;
  if (hours >= 1) return `${hours} h ${mins} m`;
  return `${Math.max(1, mins)} m`;
}
