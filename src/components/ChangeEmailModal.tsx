import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline, mailOutline } from 'ionicons/icons';
import { verifyBeforeUpdateEmail, type User } from 'firebase/auth';
import { ReauthModal } from './ReauthModal';
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
    'auth/invalid-email': 'Email no válido.',
    'auth/email-already-in-use': 'Este email ya está en uso.',
    'auth/operation-not-allowed': 'Operación no permitida. Revisa la configuración de Auth.',
  };
  return map[code] ?? 'No hemos podido enviar el email. Inténtalo de nuevo.';
}

export function ChangeEmailModal({ isOpen, user, onClose }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  const resetState = () => {
    setNewEmail('');
    setBusy(false);
    setError('');
    setSent(false);
    setReauthOpen(false);
  };

  const sendVerification = async () => {
    setError('');
    setBusy(true);
    try {
      await verifyBeforeUpdateEmail(user, newEmail.trim());
      setSent(true);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/requires-recent-login') {
        // Sesión vieja → pedimos reauth y al volver retomamos.
        setReauthOpen(true);
      } else {
        setError(translateError(code));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendVerification();
  };

  return (
    <>
      <IonModal
        isOpen={isOpen && !reauthOpen}
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
            <h2 className="settings-modal-title">Cambiar email</h2>

            {sent ? (
              <>
                <p className="settings-modal-text">
                  Te hemos enviado un email a <strong>{newEmail.trim()}</strong> con un
                  enlace de verificación.
                </p>
                <p className="settings-modal-text">
                  Tu email actual seguirá siendo <strong>{user.email}</strong> hasta que
                  hagas click en el enlace.
                </p>
                <p className="settings-modal-text" style={{ color: 'var(--btal-t-3)', fontSize: '0.82rem' }}>
                  Si no lo ves, revisa la carpeta de spam.
                </p>
                <IonButton
                  expand="block"
                  className="settings-modal-primary"
                  onClick={onClose}
                >
                  Cerrar
                </IonButton>
              </>
            ) : (
              <>
                <p className="settings-modal-text">
                  Email actual: <strong>{user.email}</strong>
                </p>
                <p className="settings-modal-text">
                  Te enviaremos un enlace de verificación a la nueva dirección.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="landing-input-wrap">
                    <IonIcon icon={mailOutline} className="landing-input-icon" />
                    <input
                      className="landing-input"
                      type="email"
                      placeholder="nuevocorreo@ejemplo.com"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      maxLength={254}
                      autoFocus
                    />
                  </div>

                  {error && <div className="landing-msg error">{error}</div>}

                  <IonButton
                    type="submit"
                    expand="block"
                    className="settings-modal-primary"
                    disabled={busy || !newEmail.trim() || newEmail.trim() === user.email}
                  >
                    {busy ? <IonSpinner name="dots" /> : 'Enviar verificación'}
                  </IonButton>
                </form>
              </>
            )}
          </div>
        </div>
      </IonModal>

      <ReauthModal
        isOpen={reauthOpen}
        user={user}
        reason="Cambiar tu email es una operación sensible. Confirma tu identidad para continuar."
        onClose={() => setReauthOpen(false)}
        onSuccess={() => {
          setReauthOpen(false);
          // Reintentamos automáticamente tras la reauth
          sendVerification();
        }}
      />
    </>
  );
}
