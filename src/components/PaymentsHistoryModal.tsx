import { IonModal } from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useProfile } from '../hooks/useProfile';
import { formatDate } from '../utils/userDisplay';
import './SettingsModal.css';
import './AccountManageModal.css';

// Historial de pagos · UI lista, datos los popula la Cloud Function
// `stripeWebhook` en Fase 6 al recibir eventos checkout.session.completed
// (pago único 4,99€) y customer.subscription.created (Pro 9,99€/mes).
// Por ahora muestra solo el estado actual del plan (userDoc.plan) como
// referencia · cuando llegue Fase 6, este modal listará `userDoc.pagos`
// (array de PagoRecord{ fecha, importe, concepto, stripePaymentId }).

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Etiqueta legible del estado actual del plan.
function currentPlanLabel(
  plan: { tipo: 'free' | 'one_off' | 'pro'; vence_en: number | null } | undefined,
): string {
  if (!plan) return 'Free';
  if (plan.tipo === 'pro') {
    return plan.vence_en
      ? `Pro · activo hasta ${formatDate(new Date(plan.vence_en).toISOString())}`
      : 'Pro · activo';
  }
  if (plan.tipo === 'one_off') {
    return plan.vence_en
      ? `Pago único · válido hasta ${formatDate(new Date(plan.vence_en).toISOString())}`
      : 'Pago único';
  }
  return 'Free';
}

export function PaymentsHistoryModal({ isOpen, onClose }: Props) {
  const { profile: userDoc } = useProfile();
  // Lista de pagos · vacía hasta Fase 6 (Stripe webhook). El array se
  // poblará desde Firestore en `userDoc.pagos` (campo a añadir entonces).
  const pagos: Array<{ fecha: number; concepto: string; importe: string }> = [];

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
      <div className="settings-modal-bg">
        <div className="settings-modal-card">
          <button
            type="button"
            className="settings-modal-close"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <MealIcon value="tb:x" size={22} />
          </button>
          <h2 className="settings-modal-title">Pagos</h2>
          <p className="settings-modal-text">
            Estado de tu suscripción e historial de pagos realizados en BTal.
          </p>

          {/* Estado actual · siempre visible */}
          <div className="account-info-card">
            <div className="account-info-item">
              <span className="account-info-label">Suscripción actual</span>
              <span className="account-info-value">
                {currentPlanLabel(userDoc?.plan)}
              </span>
            </div>
          </div>

          {/* Historial · vacío hasta Fase 6 · cuando Stripe webhook escriba
              en userDoc.pagos, esta lista renderiza cada PagoRecord. */}
          <h3 className="settings-section-title" style={{ marginTop: 20 }}>
            Historial
          </h3>
          {pagos.length === 0 ? (
            <div className="account-info-card btal-anim-fade-up">
              <p className="settings-modal-text" style={{ margin: 0 }}>
                Aún no se han realizado pagos en esta cuenta.
              </p>
              <p
                className="settings-modal-text"
                style={{ marginTop: 6, opacity: 0.7, fontSize: '0.82rem' }}
              >
                Cuando se realice un pago (Pago único 4,99€ o Pro 9,99€/mes),
                aparecerá aquí con la fecha y el concepto.
              </p>
            </div>
          ) : (
            <div className="account-info-card">
              {pagos.map((p, i) => (
                <div className="account-info-item" key={i}>
                  <span className="account-info-label">
                    {formatDate(new Date(p.fecha).toISOString())}
                  </span>
                  <span className="account-info-value">
                    {p.concepto} · {p.importe}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </IonModal>
  );
}
