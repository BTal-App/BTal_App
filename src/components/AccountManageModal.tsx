import { useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
} from '@ionic/react';
import { logoGoogle } from 'ionicons/icons';
import { MealIcon } from './MealIcon';
import type { User } from 'firebase/auth';
import { AccountInfoModal } from './AccountInfoModal';
import { ChangeEmailModal } from './ChangeEmailModal';
import { ChangeModeModal } from './ChangeModeModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { EnableTotpModal } from './EnableTotpModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { VerifyEmailRow } from './VerifyEmailRow';
import { useProfile } from '../hooks/useProfile';
import { blurAndRun } from '../utils/focus';
import {
  getEnrolledTotpFactor,
  hasGoogleProvider,
  hasPasswordProvider,
  isStandalone,
  linkGoogle,
  unenrollTotp,
  unlinkProvider,
} from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import './SettingsModal.css';
import './AccountManageModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

export function AccountManageModal({ isOpen, user, onClose }: Props) {
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [changeModeOpen, setChangeModeOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [enableTotpOpen, setEnableTotpOpen] = useState(false);
  const [confirmDisableTotpOpen, setConfirmDisableTotpOpen] = useState(false);
  const [confirmUnlinkGoogleOpen, setConfirmUnlinkGoogleOpen] = useState(false);
  const [signOutAlertOpen, setSignOutAlertOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [linkGoogleError, setLinkGoogleError] = useState('');

  // refreshUser viene del AuthContext: hace user.reload() y propaga el cambio
  // a todos los consumidores (Dashboard, AccountInfoModal, VerifyEmailRow, etc.).
  const { refreshUser } = useAuth();
  const { profile: userDoc } = useProfile();
  const profileCompleted = !!userDoc?.profile?.completed;

  const hasPassword = hasPasswordProvider(user);
  const hasGoogle = hasGoogleProvider(user);
  const enrolledTotp = getEnrolledTotpFactor(user);

  const handleLinkGoogle = async () => {
    setLinkGoogleError('');
    try {
      await linkGoogle(user);
      await refreshUser();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/credential-already-in-use') {
        setLinkGoogleError('Esta cuenta de Google ya está vinculada a otra cuenta de BTal.');
      } else if (code === 'auth/provider-already-linked') {
        setLinkGoogleError('Google ya está vinculado a esta cuenta.');
      } else {
        setLinkGoogleError('No se ha podido vincular tu cuenta con Google. Inténtalo de nuevo.');
      }
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      await unlinkProvider(user, 'google.com');
      await refreshUser();
    } catch (err) {
      console.error('[BTal] unlink google error:', err);
    }
  };

  const handleDisableTotp = async () => {
    try {
      await unenrollTotp(user);
      await refreshUser();
    } catch (err) {
      console.error('[BTal] unenroll error:', err);
    }
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
        <IonContent>
          <div className="account-manage-bg">
            <div className="account-manage-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onClose();
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
              <h2 className="settings-modal-title">Administrar cuenta</h2>

              {/* ════════ SECCIÓN PERFIL ════════ */}
              {/* Editar datos del perfil ya vive en el ProfileSheet (avatar
                  arriba a la derecha de cualquier tab). Aquí solo dejamos
                  los ajustes que NO encajan en ese sheet — el modo de
                  generación es ajuste de cuenta más profundo (afecta a IA,
                  límites, facturación) y vive aquí.
                  Solo visible si el usuario ya completó el onboarding. */}
              {profileCompleted && (
                <>
                  <h3 className="account-manage-section-title">Perfil</h3>

                  <button
                    type="button"
                    className="settings-row settings-row--link"
                    onClick={blurAndRun(() => setChangeModeOpen(true))}
                  >
                    <div className="settings-row-info">
                      <span className="settings-row-label">Modo de generación</span>
                      <span className="settings-row-value settings-row-sub">
                        {userDoc?.profile?.modo === 'ai'
                          ? 'Generar plan con IA · Pulsar para cambiar a Generación manual'
                          : 'Generar manualmente · Pulsar para generar plan con IA'}
                      </span>
                    </div>
                    <MealIcon
                      value={
                        userDoc?.profile?.modo === 'ai'
                          ? 'tb:sparkles'
                          : 'tb:edit'
                      }
                      size={20}
                      className="settings-row-chevron"
                    />
                  </button>
                </>
              )}

              {/* ════════ SECCIÓN CUENTA ════════ */}
              <h3 className="account-manage-section-title">Cuenta</h3>

              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={blurAndRun(() => setAccountInfoOpen(true))}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Información de la cuenta</span>
                  <span className="settings-row-value settings-row-sub">
                    Email, fecha de registro, métodos de inicio.
                  </span>
                </div>
                <MealIcon value="tb:info-circle" size={20} className="settings-row-chevron" />
              </button>

              {user.email && <VerifyEmailRow user={user} />}

              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={blurAndRun(() => setChangeEmailOpen(true))}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Cambiar email</span>
                  <span className="settings-row-value settings-row-sub">
                    Te enviamos verificación a la nueva dirección antes del cambio.
                  </span>
                </div>
                <MealIcon value="tb:mail" size={20} className="settings-row-chevron" />
              </button>

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
                    onClick={blurAndRun(() => setConfirmUnlinkGoogleOpen(true))}
                  >
                    Desvincular
                  </IonButton>
                ) : (
                  <IonButton
                    fill="outline"
                    size="small"
                    className="settings-row-action"
                    onClick={blurAndRun(handleLinkGoogle)}
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
                    onClick={blurAndRun(() => setConfirmDisableTotpOpen(true))}
                  >
                    Desactivar
                  </IonButton>
                ) : (
                  <IonButton
                    fill="outline"
                    size="small"
                    className="settings-row-action"
                    onClick={blurAndRun(() => setEnableTotpOpen(true))}
                  >
                    <MealIcon value="tb:shield-check" size={18} slot="start" />
                    Activar
                  </IonButton>
                )}
              </div>

              {hasPassword && (
                <button
                  type="button"
                  className="settings-row settings-row--link"
                  onClick={blurAndRun(() => setChangePasswordOpen(true))}
                >
                  <div className="settings-row-info">
                    <span className="settings-row-label">Cambiar contraseña</span>
                    <span className="settings-row-value settings-row-sub">
                      Confirma la actual y elige una nueva.
                    </span>
                  </div>
                  <MealIcon value="tb:lock" size={20} className="settings-row-chevron" />
                </button>
              )}

              {hasPassword && (
                <button
                  type="button"
                  className="settings-row settings-row--link"
                  onClick={blurAndRun(() => setForgotOpen(true))}
                >
                  <div className="settings-row-info">
                    <span className="settings-row-label">Restablecer contraseña</span>
                    <span className="settings-row-value settings-row-sub">
                      Te enviamos un enlace al email para crear una nueva sin necesitar la actual.
                    </span>
                  </div>
                  <MealIcon value="tb:key" size={20} className="settings-row-chevron" />
                </button>
              )}

              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={blurAndRun(() => setSignOutAlertOpen(true))}
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
                <MealIcon value="tb:logout" size={20} className="settings-row-chevron" />
              </button>

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
                  onClick={blurAndRun(() => setDeleteAccountOpen(true))}
                >
                  Eliminar cuenta
                </IonButton>
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* ─── Sub-modales ───────────────────────────────────────── */}
      <AccountInfoModal
        isOpen={accountInfoOpen}
        user={user}
        onClose={() => setAccountInfoOpen(false)}
      />
      <ChangeModeModal
        isOpen={changeModeOpen}
        onClose={() => setChangeModeOpen(false)}
      />
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
      {/* Reset password sin email pre-rellenado — el usuario debe teclearlo
          a propósito (suma seguridad y obliga a confirmar la dirección). */}
      <ForgotPasswordModal
        isOpen={forgotOpen}
        initialEmail=""
        onClose={() => setForgotOpen(false)}
      />
      <EnableTotpModal
        isOpen={enableTotpOpen}
        user={user}
        onClose={() => setEnableTotpOpen(false)}
        onEnrolled={refreshUser}
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
