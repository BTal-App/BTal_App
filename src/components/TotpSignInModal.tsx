import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { TotpMultiFactorGenerator, type MultiFactorResolver } from 'firebase/auth';
import './SettingsModal.css';

interface Props {
  isOpen: boolean;
  resolver: MultiFactorResolver | null;
  onClose: () => void;
  onSuccess: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-verification-code': 'Código incorrecto. Inténtalo de nuevo.',
    'auth/code-expired': 'Código caducado. Pide uno nuevo en tu app.',
    'auth/totp-challenge-timeout': 'Se ha agotado el tiempo. Vuelve a iniciar sesión.',
  };
  return map[code] ?? 'No hemos podido verificar el código.';
}

export function TotpSignInModal({ isOpen, resolver, onClose, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setCode('');
    setBusy(false);
    setError('');
  };

  // Buscamos un factor TOTP entre los enrolados.
  const totpHint = resolver?.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolver || !totpHint) return;
    setError('');
    setBusy(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        code.trim(),
      );
      await resolver.resolveSignIn(assertion);
      onSuccess();
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
          onClick={onClose}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <div className="settings-modal-card">
          <h2 className="settings-modal-title">Verificación en dos pasos</h2>
          <p className="settings-modal-text">
            Escribe el código de 6 dígitos que muestra tu app authenticator.
          </p>

          {!totpHint ? (
            <div className="landing-msg error">
              No tienes un factor TOTP enrolado. Inicia sesión sin MFA o contacta con soporte.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                className="landing-input totp-code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
              />

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="submit"
                expand="block"
                className="settings-modal-primary"
                disabled={busy || code.length !== 6}
              >
                {busy ? <IonSpinner name="dots" /> : 'Verificar'}
              </IonButton>
            </form>
          )}
        </div>
      </div>
    </IonModal>
  );
}
