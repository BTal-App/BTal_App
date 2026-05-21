import { IonModal } from '@ionic/react';
import type { User } from 'firebase/auth';
import { MealIcon } from './MealIcon';
import { formatDate, providerLabel } from '../utils/userDisplay';
import { useProfile } from '../hooks/useProfile';
import './SettingsModal.css';
import './AccountManageModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

// Label legible de cada tipo de plan, con caducidad si aplica.
function subscriptionLabel(
  plan: { tipo: 'free' | 'one_off' | 'pro'; vence_en: number | null } | undefined,
): string {
  if (!plan) return '—';
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

export function AccountInfoModal({ isOpen, user, onClose }: Props) {
  const { profile: userDoc } = useProfile();
  // Etiquetas únicas de los providers (puede haber duplicados teóricos).
  const providers = user.providerData
    .map((p) => providerLabel(p.providerId))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
      <div className="settings-modal-bg">
        <div className="settings-modal-card">
          {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
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
          <h2 className="settings-modal-title">Información de la cuenta</h2>
          <p className="settings-modal-text">
            Datos de tu cuenta de BTal.
          </p>

          <div className="account-info-card">
            <div className="account-info-item">
              <span className="account-info-label">Email</span>
              <span className="account-info-value">
                {user.email ?? '—'}
                {user.emailVerified && (
                  <span
                    style={{
                      color: 'var(--btal-cyan)',
                      marginLeft: 6,
                      verticalAlign: 'middle',
                      display: 'inline-flex',
                    }}
                  >
                    <MealIcon
                      value="tb:circle-check-filled"
                      size={16}
                      ariaLabel="Verificado"
                    />
                  </span>
                )}
              </span>
            </div>
            <div className="account-info-item">
              <span className="account-info-label">Nombre</span>
              <span className="account-info-value">
                {user.displayName?.trim() || '—'}
              </span>
            </div>
            <div className="account-info-item">
              <span className="account-info-label">Fecha de registro</span>
              <span className="account-info-value">
                {formatDate(user.metadata.creationTime)}
              </span>
            </div>
            <div className="account-info-item">
              <span className="account-info-label">Última conexión</span>
              <span className="account-info-value">
                {formatDate(user.metadata.lastSignInTime)}
              </span>
            </div>
            <div className="account-info-item">
              <span className="account-info-label">Inicio sesión</span>
              <span className="account-info-value account-info-providers">
                {providers.length > 0 ? (
                  providers.map((p) => (
                    <span key={p} className="account-info-provider">
                      {p}
                    </span>
                  ))
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="account-info-item">
              <span className="account-info-label">Suscripción</span>
              <span className="account-info-value">
                {subscriptionLabel(userDoc?.plan)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </IonModal>
  );
}
