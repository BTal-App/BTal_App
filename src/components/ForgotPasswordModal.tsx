import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline, mailOutline } from 'ionicons/icons';
import { resetPassword } from '../services/auth';
import './ForgotPasswordModal.css';

interface Props {
  isOpen: boolean;
  initialEmail?: string;
  onClose: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email no válido.',
    'auth/user-not-found': 'No existe una cuenta con este email.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
  };
  return map[code] ?? 'No hemos podido enviar el email. Inténtalo de nuevo.';
}

export function ForgotPasswordModal({ isOpen, initialEmail = '', onClose }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const resetState = () => {
    setEmail(initialEmail);
    setError('');
    setSent(false);
    setBusy(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email.trim());
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
      className="forgot-modal"
    >
      <div className="forgot-bg">
        <button
          type="button"
          className="forgot-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <div className="forgot-card">
          <h2 className="forgot-title">Restablecer contraseña</h2>

          {sent ? (
            <>
              <p className="forgot-text">
                Te hemos enviado un email a <strong>{email.trim()}</strong> con un
                enlace para crear una nueva contraseña.
              </p>
              <p className="forgot-text forgot-text--muted">
                Si no lo ves en unos minutos, revisa la carpeta de spam.
              </p>
              <IonButton
                expand="block"
                className="forgot-primary"
                onClick={onClose}
              >
                Cerrar
              </IonButton>
            </>
          ) : (
            <>
              <p className="forgot-text">
                Escribe tu email y te enviaremos un enlace para crear una contraseña
                nueva.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="landing-input-wrap">
                  <IonIcon icon={mailOutline} className="landing-input-icon" />
                  <input
                    className="landing-input"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && <div className="landing-msg error">{error}</div>}

                <IonButton
                  type="submit"
                  expand="block"
                  className="forgot-primary"
                  disabled={busy || !email.trim()}
                >
                  {busy ? <IonSpinner name="dots" /> : 'Enviar email'}
                </IonButton>
              </form>
            </>
          )}
        </div>
      </div>
    </IonModal>
  );
}
