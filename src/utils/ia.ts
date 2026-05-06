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
      hint: 'Crea cuenta para usar la IA · es gratis.',
    };
  }
  if (!userDoc) {
    return { allowed: false, reason: 'manual_mode' };
  }
  if (userDoc.profile.modo !== 'ai') {
    return {
      allowed: false,
      reason: 'manual_mode',
      hint: 'Cambia a modo IA en Ajustes para generar tu plan.',
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
      hint: 'Generación extra disponible · adelantada por tu pago de 4,99€.',
    };
  }

  // Free: 1 gen al mes (opción 1 estricta — sea total o parcial cuenta igual).
  // Ciclo lo gestiona la Cloud Function. El cliente solo lee.
  const consumidas = userDoc.generaciones.consumidas_ciclo;
  if (consumidas === 0) {
    return { allowed: true, reason: 'ok_free' };
  }

  // Bloqueado · ya gastó la gen del mes.
  const unlocksAt = addTreintaDias(userDoc.generaciones.ciclo_inicio);
  return {
    allowed: false,
    reason: 'limit_reached',
    unlocksAt,
    hint:
      `Disponible el ${formatFecha(unlocksAt)}. ` +
      'Adelanta por 4,99€ o pasa a Pro para regenerar ya.',
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
