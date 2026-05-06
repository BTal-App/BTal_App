import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import {
  closeOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { changePassword, reauthEmail } from '../services/auth';
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
    'auth/weak-password': 'Contraseña nueva débil.',
    'auth/too-many-requests':
      'Se ha superado el número máximo de intentos. Por favor, espere unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
  };
  return map[code] ?? 'No hemos podido cambiar la contraseña. Inténtalo de nuevo.';
}

function validatePasswordStrength(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial.';
  return null;
}

export function ChangePasswordModal({ isOpen, user, onClose }: Props) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const resetState = () => {
    setCurrentPwd('');
    setNewPwd('');
    setNewPwd2('');
    setShowPwd(false);
    setBusy(false);
    setError('');
    setDone(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const pwdError = validatePasswordStrength(newPwd);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (newPwd !== newPwd2) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPwd === currentPwd) {
      setError('La nueva contraseña debe ser distinta de la actual.');
      return;
    }

    setBusy(true);
    try {
      // Reauth con la contraseña actual antes de cambiarla — Firebase lo
      // exige y de paso valida que el usuario sabe la actual.
      await reauthEmail(user, currentPwd);
      await changePassword(user, newPwd);
      setDone(true);
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

          {done ? (
            <>
              <p className="settings-modal-text">
                Contraseña actualizada correctamente.
              </p>
              <IonButton expand="block" className="settings-modal-primary" onClick={onClose}>
                Cerrar
              </IonButton>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="landing-input-wrap">
                <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                <input
                  className="landing-input landing-input--password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña actual"
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

              <div className="landing-input-wrap">
                <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                <input
                  className="landing-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña nueva"
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="landing-input-wrap">
                <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                <input
                  className="landing-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Confirmar nueva"
                  autoComplete="new-password"
                  value={newPwd2}
                  onChange={(e) => setNewPwd2(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <p className="landing-hint">
                Mínimo 8 caracteres · 1 mayúscula · 1 número · 1 carácter especial
              </p>

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="submit"
                expand="block"
                className="settings-modal-primary"
                disabled={busy || !currentPwd || !newPwd || !newPwd2}
              >
                {busy ? <IonSpinner name="dots" /> : 'Guardar nueva contraseña'}
              </IonButton>
            </form>
          )}
        </div>
      </div>
    </IonModal>
  );
}
