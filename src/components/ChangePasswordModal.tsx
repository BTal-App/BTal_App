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
  // Cuando el usuario pulsa "¿Has olvidado la contraseña?" en el primer paso.
  // El padre debería cerrar este modal y abrir ForgotPasswordModal.
  onForgot: () => void;
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

// Flujo en 2 pasos al estilo Instagram (sin el envío de código por email,
// que requiere Cloud Functions; usamos la contraseña actual como gate
// equivalente). Cuando se active el backend en la Fase 6 del roadmap se
// puede insertar antes un paso de "código enviado a tu email".
type Stage = 'verify' | 'new' | 'done';

export function ChangePasswordModal({ isOpen, user, onClose, onForgot }: Props) {
  const [stage, setStage] = useState<Stage>('verify');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setStage('verify');
    setCurrentPwd('');
    setNewPwd('');
    setNewPwd2('');
    setShowPwd(false);
    setBusy(false);
    setError('');
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await reauthEmail(user, currentPwd);
      setStage('new');
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleSetNew = async (e: FormEvent) => {
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
      await changePassword(user, newPwd);
      setStage('done');
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotClick = () => {
    onForgot();
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

          {stage === 'verify' && (
            <>
              <p className="settings-modal-text">
                Para tu seguridad, primero confirma tu contraseña actual.
              </p>
              <form onSubmit={handleVerify}>
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
                    maxLength={128}
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
                  {busy ? <IonSpinner name="dots" /> : 'Continuar'}
                </IonButton>

                <button
                  type="button"
                  className="landing-link"
                  onClick={handleForgotClick}
                >
                  ¿Has olvidado la contraseña?
                </button>
              </form>
            </>
          )}

          {stage === 'new' && (
            <>
              <p className="settings-modal-text">
                Identidad confirmada. Ahora elige una contraseña nueva.
              </p>
              <form onSubmit={handleSetNew}>
                <div className="landing-input-wrap">
                  <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                  <input
                    className="landing-input landing-input--password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Contraseña nueva"
                    autoComplete="new-password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
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
                    placeholder="Confirmar nueva"
                    autoComplete="new-password"
                    value={newPwd2}
                    onChange={(e) => setNewPwd2(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
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
                  disabled={busy || !newPwd || !newPwd2}
                >
                  {busy ? <IonSpinner name="dots" /> : 'Guardar nueva contraseña'}
                </IonButton>
              </form>
            </>
          )}

          {stage === 'done' && (
            <>
              <p className="settings-modal-text">
                Contraseña actualizada correctamente.
              </p>
              <p className="settings-modal-text" style={{ color: 'var(--btal-t-3)', fontSize: '0.82rem' }}>
                Por seguridad, recomendamos cerrar sesión en otros dispositivos desde el siguiente
                paso o iniciar sesión de nuevo en ellos.
              </p>
              <IonButton expand="block" className="settings-modal-primary" onClick={onClose}>
                Cerrar
              </IonButton>
            </>
          )}
        </div>
      </div>
    </IonModal>
  );
}
