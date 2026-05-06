import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import {
  closeOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { reauthEmail, resetPassword } from '../services/auth';
import './SettingsModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/wrong-password': 'Contraseña actual incorrecta.',
    'auth/invalid-credential': 'Contraseña actual incorrecta.',
    'auth/too-many-requests':
      'Se ha superado el número máximo de intentos. Por favor, espere unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/user-not-found': 'No existe cuenta con este email.',
  };
  return map[code] ?? 'No hemos podido enviar el email. Inténtalo de nuevo.';
}

export function ChangePasswordModal({ isOpen, user, onClose }: Props) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const resetState = () => {
    setCurrentPwd('');
    setShowPwd(false);
    setBusy(false);
    setError('');
    setSent(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user.email) {
      setError('Esta cuenta no tiene email — no puedes cambiar la contraseña por aquí.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      // Paso 1: confirma identidad reauth con la contraseña actual
      // (Firebase lo exige y de paso valida que el usuario sabe la actual).
      await reauthEmail(user, currentPwd);
      // Paso 2: dispara el flujo estándar de reset por email — el enlace del
      // email abrirá /auth/action?mode=resetPassword donde se pone la nueva.
      await resetPassword(user.email);
      setSent(true);
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onWillPresent={resetState}
      onDidDismiss={onClose}
      className="settings-modal"
    >
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

        <div className="settings-modal-card">
          <h2 className="settings-modal-title">Cambiar contraseña</h2>

          {sent ? (
            <>
              <p className="settings-modal-text">
                Te hemos enviado un email a <strong>{user.email}</strong> con un enlace
                seguro para crear una nueva contraseña.
              </p>
              <p className="settings-modal-text" style={{ color: 'var(--btal-t-3)', fontSize: '0.82rem' }}>
                Si no lo ves en unos minutos, revisa la carpeta de spam.
              </p>
              <IonButton expand="block" className="settings-modal-primary" onClick={onClose}>
                Cerrar
              </IonButton>
            </>
          ) : (
            <>
              <p className="settings-modal-text">
                Para tu seguridad, te enviaremos un enlace por email. Antes confirma tu
                contraseña actual.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="landing-input-wrap">
                  <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                  <input
                    className="landing-input landing-input--password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Tu contraseña actual"
                    autoComplete="current-password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="landing-input-toggle"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <IonIcon icon={showPwd ? eyeOffOutline : eyeOutline} />
                  </button>
                </div>

                {error && <div className="landing-msg error">{error}</div>}

                <IonButton
                  type="submit"
                  expand="block"
                  className="settings-modal-primary"
                  disabled={busy || !currentPwd}
                >
                  {busy ? <IonSpinner name="dots" /> : 'Enviar enlace por email'}
                </IonButton>
              </form>
            </>
          )}
        </div>
      </div>
    </IonModal>
  );
}
