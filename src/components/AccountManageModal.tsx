import { useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonIcon,
  IonModal,
} from '@ionic/react';
import {
  checkmarkCircle,
  closeOutline,
  keyOutline,
  lockClosedOutline,
  logOutOutline,
  logoGoogle,
  mailOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { ChangeEmailModal } from './ChangeEmailModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { EnableTotpModal } from './EnableTotpModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { VerifyEmailRow } from './VerifyEmailRow';
import {
  getEnrolledTotpFactor,
  hasGoogleProvider,
  hasPasswordProvider,
  isStandalone,
  linkGoogle,
  unenrollTotp,
  unlinkProvider,
} from '../services/auth';
import { formatLongDate, providerLabel } from '../utils/userDisplay';
import './SettingsModal.css';
import './AccountManageModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

export function AccountManageModal({ isOpen, user, onClose }: Props) {
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [enableTotpOpen, setEnableTotpOpen] = useState(false);
  const [confirmDisableTotpOpen, setConfirmDisableTotpOpen] = useState(false);
  const [confirmUnlinkGoogleOpen, setConfirmUnlinkGoogleOpen] = useState(false);
  const [signOutAlertOpen, setSignOutAlertOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [linkGoogleError, setLinkGoogleError] = useState('');

  // Tick para forzar re-render tras user.reload (los providerData / MFA / etc.
  // mutan en sitio pero no disparan onAuthStateChanged).
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const hasPassword = hasPasswordProvider(user);
  const hasGoogle = hasGoogleProvider(user);
  const enrolledTotp = getEnrolledTotpFactor(user);

  const handleLinkGoogle = async () => {
    setLinkGoogleError('');
    try {
      await linkGoogle(user);
      await user.reload();
      refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/credential-already-in-use') {
        setLinkGoogleError('Esa cuenta de Google ya está vinculada a otra cuenta de BTal.');
      } else if (code === 'auth/provider-already-linked') {
        setLinkGoogleError('Google ya está vinculado a esta cuenta.');
      } else {
        setLinkGoogleError('No hemos podido vincular Google. Inténtalo de nuevo.');
      }
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      await unlinkProvider(user, 'google.com');
      await user.reload();
      refresh();
    } catch (err) {
      console.error('[BTal] unlink google error:', err);
    }
  };

  const handleDisableTotp = async () => {
    try {
      await unenrollTotp(user);
      await user.reload();
      refresh();
    } catch (err) {
      console.error('[BTal] unenroll error:', err);
    }
  };

  const providers = user.providerData
    .map((p) => providerLabel(p.providerId))
    .filter((v, i, arr) => arr.indexOf(v) === i); // únicos

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
        <div className="settings-modal-bg account-manage-bg">
          <button
            type="button"
            className="settings-modal-close"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <div className="settings-modal-card account-manage-card">
            <h2 className="settings-modal-title">Administrar cuenta</h2>

            {/* ════════ SECCIÓN CUENTA ════════ */}
            <h3 className="account-manage-section-title">Cuenta</h3>

            {/* Información de la cuenta · solo lectura */}
            <div className="account-info-card">
              <div className="account-info-item">
                <span className="account-info-label">Email</span>
                <span className="account-info-value">
                  {user.email ?? '—'}
                  {user.emailVerified && (
                    <IonIcon
                      icon={checkmarkCircle}
                      style={{
                        color: 'var(--btal-cyan)',
                        marginLeft: 6,
                        verticalAlign: 'middle',
                      }}
                      aria-label="Verificado"
                    />
                  )}
                </span>
              </div>
              <div className="account-info-item">
                <span className="account-info-label">Fecha de registro</span>
                <span className="account-info-value">
                  {formatLongDate(user.metadata.creationTime)}
                </span>
              </div>
              <div className="account-info-item">
                <span className="account-info-label">Última conexión</span>
                <span className="account-info-value">
                  {formatLongDate(user.metadata.lastSignInTime)}
                </span>
              </div>
              <div className="account-info-item">
                <span className="account-info-label">Métodos</span>
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
            </div>

            {/* Verificar cuenta · sincroniza con el banner del Dashboard */}
            {user.email && (
              <VerifyEmailRow user={user} onRefreshed={refresh} />
            )}

            {/* Cambiar email */}
            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={() => setChangeEmailOpen(true)}
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Cambiar email</span>
                <span className="settings-row-value settings-row-sub">
                  Te enviamos verificación a la nueva dirección antes del cambio.
                </span>
              </div>
              <IonIcon icon={mailOutline} className="settings-row-chevron" />
            </button>

            {/* Cuenta de Google · vincular / desvincular */}
            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Cuenta de Google</span>
                <span className="settings-row-value settings-row-sub">
                  {hasGoogle
                    ? 'Vinculada · puedes iniciar sesión con Google'
                    : 'Vincúlala para iniciar sesión también con Google'}
                </span>
                {!hasGoogle && isStandalone() && (
                  <span className="settings-row-warn">
                    En la app instalada el flujo de Google puede fallar (limitación de iOS PWA).
                    Si no funciona, vincúlala desde el navegador.
                  </span>
                )}
                {linkGoogleError && (
                  <span className="settings-row-error">{linkGoogleError}</span>
                )}
              </div>
              {hasGoogle ? (
                <IonButton
                  fill="outline"
                  color="danger"
                  size="small"
                  className="settings-row-action"
                  onClick={() => setConfirmUnlinkGoogleOpen(true)}
                >
                  Desvincular
                </IonButton>
              ) : (
                <IonButton
                  fill="outline"
                  size="small"
                  className="settings-row-action"
                  onClick={handleLinkGoogle}
                >
                  <IonIcon icon={logoGoogle} slot="start" />
                  Vincular
                </IonButton>
              )}
            </div>

            {/* ════════ SECCIÓN SEGURIDAD ════════ */}
            <h3 className="account-manage-section-title">Seguridad</h3>

            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Verificación en dos pasos (TOTP)</span>
                <span className="settings-row-value settings-row-sub">
                  {enrolledTotp
                    ? 'Activada · te pediremos el código al iniciar sesión'
                    : 'Añade una capa extra de seguridad con tu app authenticator'}
                </span>
              </div>
              {enrolledTotp ? (
                <IonButton
                  fill="outline"
                  color="danger"
                  size="small"
                  className="settings-row-action"
                  onClick={() => setConfirmDisableTotpOpen(true)}
                >
                  Desactivar
                </IonButton>
              ) : (
                <IonButton
                  fill="outline"
                  size="small"
                  className="settings-row-action"
                  onClick={() => setEnableTotpOpen(true)}
                >
                  <IonIcon icon={shieldCheckmarkOutline} slot="start" />
                  Activar
                </IonButton>
              )}
            </div>

            {hasPassword && (
              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={() => setChangePasswordOpen(true)}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Cambiar contraseña</span>
                  <span className="settings-row-value settings-row-sub">
                    Confirma la actual y elige una nueva.
                  </span>
                </div>
                <IonIcon icon={lockClosedOutline} className="settings-row-chevron" />
              </button>
            )}

            {hasPassword && (
              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={() => setForgotOpen(true)}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Restablecer contraseña</span>
                  <span className="settings-row-value settings-row-sub">
                    Te enviamos un enlace al email para crear una nueva sin necesitar la actual.
                  </span>
                </div>
                <IonIcon icon={keyOutline} className="settings-row-chevron" />
              </button>
            )}

            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={() => setSignOutAlertOpen(true)}
            >
              <div className="settings-row-info">
                <span className="settings-row-label">
                  Cerrar sesión en otros dispositivos
                  <span className="account-manage-soon">próximamente</span>
                </span>
                <span className="settings-row-value settings-row-sub">
                  Mantiene esta sesión y cierra el resto.
                </span>
              </div>
              <IonIcon icon={logOutOutline} className="settings-row-chevron" />
            </button>

            {/* Eliminar cuenta · acción destructiva, en rojo, al final */}
            <div className="settings-row settings-row--danger">
              <div className="settings-row-info">
                <span className="settings-row-label">Eliminar cuenta</span>
                <span className="settings-row-value settings-row-sub">
                  Borra tu cuenta de forma permanente. Esta acción no se puede deshacer.
                </span>
              </div>
              <IonButton
                fill="outline"
                color="danger"
                size="small"
                className="settings-row-action"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Eliminar cuenta
              </IonButton>
            </div>
          </div>
        </div>
      </IonModal>

      {/* ─── Sub-modales ───────────────────────────────────────── */}
      <ChangeEmailModal
        isOpen={changeEmailOpen}
        user={user}
        onClose={() => setChangeEmailOpen(false)}
      />
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        user={user}
        onClose={() => setChangePasswordOpen(false)}
        onForgot={() => {
          setChangePasswordOpen(false);
          setForgotOpen(true);
        }}
      />
      <ForgotPasswordModal
        isOpen={forgotOpen}
        initialEmail={user.email ?? ''}
        onClose={() => setForgotOpen(false)}
      />
      <EnableTotpModal
        isOpen={enableTotpOpen}
        user={user}
        onClose={() => setEnableTotpOpen(false)}
        onEnrolled={refresh}
      />
      <DeleteAccountModal
        isOpen={deleteAccountOpen}
        user={user}
        onClose={() => setDeleteAccountOpen(false)}
      />

      <IonAlert
        isOpen={confirmDisableTotpOpen}
        onDidDismiss={() => setConfirmDisableTotpOpen(false)}
        header="¿Desactivar 2FA?"
        message="Tu cuenta volverá a usar solo email y contraseña para iniciar sesión. Podrás reactivarla en cualquier momento."
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Desactivar',
            role: 'destructive',
            handler: () => {
              handleDisableTotp();
            },
          },
        ]}
      />
      <IonAlert
        isOpen={confirmUnlinkGoogleOpen}
        onDidDismiss={() => setConfirmUnlinkGoogleOpen(false)}
        header="¿Desvincular Google?"
        message={
          hasPassword
            ? 'Tu cuenta seguirá funcionando con email y contraseña. Podrás volver a vincular Google cuando quieras.'
            : 'Si desvinculas Google y no tienes contraseña configurada, te quedarás sin método de inicio de sesión. Configura una contraseña primero (Restablecer contraseña).'
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          ...(hasPassword
            ? [
                {
                  text: 'Desvincular',
                  role: 'destructive',
                  handler: () => {
                    handleUnlinkGoogle();
                  },
                },
              ]
            : []),
        ]}
      />
      <IonAlert
        isOpen={signOutAlertOpen}
        onDidDismiss={() => setSignOutAlertOpen(false)}
        header="Cerrar sesión en otros dispositivos"
        message={
          'Esta función necesita que activemos las Cloud Functions del backend (Fase 6 del roadmap). ' +
          'Mientras tanto: si cambias tu contraseña, todas las demás sesiones se cerrarán automáticamente.'
        }
        buttons={[{ text: 'Entendido', role: 'cancel' }]}
      />
    </>
  );
}
