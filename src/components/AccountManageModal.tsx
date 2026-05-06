import { useState } from 'react';
import { IonAlert, IonIcon, IonModal } from '@ionic/react';
import {
  closeOutline,
  keyOutline,
  lockClosedOutline,
  logOutOutline,
  mailOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { ChangeEmailModal } from './ChangeEmailModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { hasPasswordProvider } from '../services/auth';
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
  const [signOutAlertOpen, setSignOutAlertOpen] = useState(false);

  const hasPassword = hasPasswordProvider(user);

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
        <div className="settings-modal-bg">
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
            <p className="settings-modal-text">
              Cambia tu email, contraseña y gestiona la seguridad de tu cuenta.
            </p>

            <div className="account-manage-list">
              <button
                type="button"
                className="account-manage-row"
                onClick={() => setChangeEmailOpen(true)}
              >
                <IonIcon icon={mailOutline} />
                <div className="account-manage-row-info">
                  <span className="account-manage-row-title">Cambiar email</span>
                  <span className="account-manage-row-sub">{user.email}</span>
                </div>
              </button>

              {hasPassword && (
                <button
                  type="button"
                  className="account-manage-row"
                  onClick={() => setChangePasswordOpen(true)}
                >
                  <IonIcon icon={lockClosedOutline} />
                  <div className="account-manage-row-info">
                    <span className="account-manage-row-title">Cambiar contraseña</span>
                    <span className="account-manage-row-sub">
                      Confirma la actual y elige una nueva.
                    </span>
                  </div>
                </button>
              )}

              {hasPassword && (
                <button
                  type="button"
                  className="account-manage-row"
                  onClick={() => setForgotOpen(true)}
                >
                  <IonIcon icon={keyOutline} />
                  <div className="account-manage-row-info">
                    <span className="account-manage-row-title">Restablecer contraseña</span>
                    <span className="account-manage-row-sub">
                      Te enviamos un enlace al email para crear una nueva sin necesitar la actual.
                    </span>
                  </div>
                </button>
              )}

              <button
                type="button"
                className="account-manage-row"
                onClick={() => setSignOutAlertOpen(true)}
              >
                <IonIcon icon={logOutOutline} />
                <div className="account-manage-row-info">
                  <span className="account-manage-row-title">
                    Cerrar sesión en otros dispositivos
                    <span className="account-manage-soon">próximamente</span>
                  </span>
                  <span className="account-manage-row-sub">
                    Mantiene esta sesión y cierra el resto. Útil si has perdido un dispositivo.
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </IonModal>

      {/* Sub-modales que se abren encima del AccountManage */}
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
