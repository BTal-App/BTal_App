import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline, lockClosedOutline, logoGoogle } from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { reauthEmail, reauthGoogle } from '../services/auth';
import './SettingsModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  reason?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Credenciales no válidas.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
  };
  return map[code] ?? 'No hemos podido confirmar tu identidad. Inténtalo de nuevo.';
}

// Detecta si el usuario se autenticó con password o con Google.
const usedPassword = (user: User) =>
  user.providerData.some((p) => p.providerId === 'password');

const usedGoogle = (user: User) =>
  user.providerData.some((p) => p.providerId === 'google.com');

export function ReauthModal({ isOpen, user, reason, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setPassword('');
    setBusy(false);
    setError('');
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await reauthEmail(user, password);
      onSuccess();
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await reauthGoogle(user);
      onSuccess();
    } catch (err) {
      const code = errorCode(err);
      const msg = translateError(code);
      if (msg) setError(msg);
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
          <h2 className="settings-modal-title">Confirma tu identidad</h2>
          <p className="settings-modal-text">
            {reason ?? 'Por seguridad, te pedimos confirmar tu identidad antes de continuar.'}
          </p>

          {usedPassword(user) && (
            <form onSubmit={handlePasswordSubmit}>
              <div className="landing-input-wrap">
                <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                <input
                  className="landing-input"
                  type="password"
                  placeholder="Tu contraseña actual"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="submit"
                expand="block"
                className="settings-modal-primary"
                disabled={busy || !password}
              >
                {busy ? <IonSpinner name="dots" /> : 'Confirmar'}
              </IonButton>
            </form>
          )}

          {usedGoogle(user) && (
            <>
              {usedPassword(user) && <div className="landing-divider">o</div>}
              <IonButton
                type="button"
                expand="block"
                className="landing-google"
                onClick={handleGoogle}
                disabled={busy}
              >
                <IonIcon icon={logoGoogle} slot="start" />
                Confirmar con Google
              </IonButton>
              {!usedPassword(user) && error && <div className="landing-msg error">{error}</div>}
            </>
          )}
        </div>
      </div>
    </IonModal>
  );
}
