import { useEffect, useState, type FormEvent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { eyeOffOutline, eyeOutline, lockClosedOutline } from 'ionicons/icons';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import './AuthAction.css';

type Mode = 'resetPassword' | 'verifyEmail' | 'recoverEmail' | null;

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/expired-action-code': 'El enlace ha caducado. Solicita uno nuevo.',
    'auth/invalid-action-code': 'Enlace no válido o ya usado.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/user-not-found': 'No existe la cuenta asociada a este enlace.',
    'auth/weak-password': 'Contraseña débil. Mínimo 8 caracteres.',
  };
  return map[code] ?? 'Algo ha salido mal. Vuelve a empezar.';
}

function validatePasswordStrength(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial.';
  return null;
}

const AuthAction: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') as Mode;
  const oobCode = params.get('oobCode') ?? '';

  const [verifying, setVerifying] = useState(true);
  const [emailForReset, setEmailForReset] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Estado del formulario de reset
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode || !mode) {
        setError('Enlace no válido. Falta información necesaria.');
        setVerifying(false);
        return;
      }

      try {
        if (mode === 'resetPassword') {
          // Verifica el código y obtiene el email asociado, sin completarlo aún.
          const email = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) setEmailForReset(email);
        } else if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) setInfo('Email verificado correctamente.');
        } else if (mode === 'recoverEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelled) setInfo('Cambio de email revertido.');
        } else {
          if (!cancelled) setError('Acción desconocida.');
        }
      } catch (err) {
        if (!cancelled) setError(translateError(errorCode(err)));
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="auth-action-bg">
          <div className="auth-action-hero">
            <div className="auth-action-logo-wrap">
              <img src="/logo.png" alt="BTal" className="auth-action-logo" />
            </div>
          </div>

          <div className="auth-action-card">
            {verifying ? (
              <div className="auth-action-loading">
                <IonSpinner name="dots" />
                <p>Verificando enlace…</p>
              </div>
            ) : error ? (
              <>
                <h2 className="auth-action-title">Enlace no válido</h2>
                <div className="landing-msg error">{error}</div>
                <IonButton
                  expand="block"
                  className="auth-action-primary"
                  onClick={() => history.replace('/')}
                >
                  Volver a la landing
                </IonButton>
              </>
            ) : mode === 'resetPassword' ? (
              done ? (
                <>
                  <h2 className="auth-action-title">Contraseña actualizada</h2>
                  <p className="auth-action-text">
                    Ya puedes iniciar sesión con tu nueva contraseña.
                  </p>
                  <IonButton
                    expand="block"
                    className="auth-action-primary"
                    onClick={() => history.replace('/')}
                  >
                    Iniciar sesión
                  </IonButton>
                </>
              ) : (
                <>
                  <h2 className="auth-action-title">Nueva contraseña</h2>
                  <p className="auth-action-text">
                    Para <strong>{emailForReset}</strong>
                  </p>

                  <form onSubmit={handleResetSubmit}>
                    <div className="landing-input-wrap">
                      <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
                      <input
                        className="landing-input landing-input--password"
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
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
                        placeholder="Confirmar contraseña"
                        autoComplete="new-password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
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
                      className="auth-action-primary"
                      disabled={busy}
                    >
                      {busy ? <IonSpinner name="dots" /> : 'Guardar contraseña'}
                    </IonButton>
                  </form>
                </>
              )
            ) : (
              <>
                <h2 className="auth-action-title">¡Listo!</h2>
                {info && <div className="landing-msg info">{info}</div>}
                <IonButton
                  expand="block"
                  className="auth-action-primary"
                  onClick={() => history.replace('/')}
                >
                  Continuar
                </IonButton>
              </>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthAction;
