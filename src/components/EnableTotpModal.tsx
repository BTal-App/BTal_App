import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import QRCode from 'react-qr-code';
import type { TotpSecret, User } from 'firebase/auth';
import { finishTotpEnrollment, startTotpEnrollment } from '../services/auth';
import { ReauthModal } from './ReauthModal';
import './SettingsModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onEnrolled: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-verification-code': 'Código incorrecto. Mira la app authenticator y vuelve a intentarlo.',
    'auth/code-expired': 'Código caducado. Pide uno nuevo en tu app.',
    'auth/totp-challenge-timeout': 'Se ha agotado el tiempo. Vuelve a empezar.',
    'auth/operation-not-allowed': 'TOTP no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method → Verificación en dos pasos.',
    'auth/unverified-email': 'Necesitas verificar tu email antes de activar 2FA. Mira tu bandeja (y spam) y haz click en el enlace.',
    'auth/admin-restricted-operation': 'Operación bloqueada por configuración del proyecto. Revisa Identity Platform.',
    'auth/requires-recent-login': 'Tu sesión es vieja. Cierra sesión y vuelve a entrar.',
  };
  return map[code] ?? `No hemos podido activar MFA (${code || 'error desconocido'}).`;
}

export function EnableTotpModal({ isOpen, user, onClose, onEnrolled }: Props) {
  const [stage, setStage] = useState<'init' | 'qr' | 'done'>('init');
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reauthOpen, setReauthOpen] = useState(false);

  const resetState = () => {
    setStage('init');
    setSecret(null);
    setQrUrl('');
    setCode('');
    setBusy(false);
    setError('');
    setReauthOpen(false);
  };

  const startEnrollment = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await startTotpEnrollment(user);
      setSecret(res.secret);
      setQrUrl(res.qrUrl);
      setStage('qr');
    } catch (err) {
      const code = errorCode(err);
      console.error('[BTal] startTotpEnrollment error:', code, err);
      if (code === 'auth/requires-recent-login') {
        setReauthOpen(true);
      } else {
        setError(translateError(code));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    setError('');
    setBusy(true);
    try {
      await finishTotpEnrollment(user, secret, code.trim(), 'Authenticator');
      setStage('done');
      onEnrolled();
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IonModal
        isOpen={isOpen && !reauthOpen}
        onWillPresent={() => {
          resetState();
          // Arrancamos la enrollment al abrir
          startEnrollment();
        }}
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
            {stage === 'init' && (
              <>
                <h2 className="settings-modal-title">Activar verificación en dos pasos</h2>
                <p className="settings-modal-text">Generando código QR…</p>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <IonSpinner name="dots" />
                </div>
                {error && <div className="landing-msg error">{error}</div>}
              </>
            )}

            {stage === 'qr' && qrUrl && secret && (
              <>
                <h2 className="settings-modal-title">Activar verificación en dos pasos</h2>

                <p className="settings-modal-text">
                  <span className="totp-step-label">1. Escanea</span>
                </p>
                <p className="settings-modal-text" style={{ marginTop: -10 }}>
                  Abre tu app authenticator (Google Authenticator, Authy, 1Password…) y escanea
                  este código:
                </p>
                <div className="totp-qr-wrap">
                  <QRCode value={qrUrl} size={180} bgColor="#ffffff" fgColor="#0a0e0c" />
                </div>
                <p className="settings-modal-text" style={{ fontSize: '0.82rem', color: 'var(--btal-t-3)' }}>
                  Si no puedes escanear, introduce esta clave manualmente:
                </p>
                <div className="totp-secret">{secret.secretKey}</div>

                <p className="settings-modal-text" style={{ marginTop: 12 }}>
                  <span className="totp-step-label">2. Verifica</span>
                </p>
                <p className="settings-modal-text" style={{ marginTop: -10 }}>
                  Escribe el código de 6 dígitos que muestra la app:
                </p>

                <form onSubmit={handleVerify}>
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
                  />

                  {error && <div className="landing-msg error">{error}</div>}

                  <IonButton
                    type="submit"
                    expand="block"
                    className="settings-modal-primary"
                    disabled={busy || code.length !== 6}
                  >
                    {busy ? <IonSpinner name="dots" /> : 'Activar'}
                  </IonButton>
                </form>
              </>
            )}

            {stage === 'done' && (
              <>
                <h2 className="settings-modal-title">¡Activado!</h2>
                <p className="settings-modal-text">
                  La verificación en dos pasos ya está activa. La próxima vez que inicies sesión, te
                  pediremos el código de tu app.
                </p>
                <IonButton expand="block" className="settings-modal-primary" onClick={onClose}>
                  Hecho
                </IonButton>
              </>
            )}
          </div>
        </div>
      </IonModal>

      <ReauthModal
        isOpen={reauthOpen}
        user={user}
        reason="Activar la verificación en dos pasos es una operación sensible. Confirma tu identidad para continuar."
        onClose={() => {
          setReauthOpen(false);
          onClose();
        }}
        onSuccess={() => {
          setReauthOpen(false);
          startEnrollment();
        }}
      />
    </>
  );
}
