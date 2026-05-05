import { useEffect, useState, type FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  logoGoogle,
  mailOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import {
  signInEmail,
  signInGoogle,
  signInGuest,
  signUpEmail,
} from '../services/auth';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import './Landing.css';

type Mode = 'signin' | 'signup';

function translateAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Este email ya está registrado.',
    'auth/invalid-email': 'Email no válido.',
    'auth/weak-password': 'Contraseña débil (mínimo 6 caracteres).',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/user-not-found': 'No existe una cuenta con este email.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/missing-password': 'Falta la contraseña.',
  };
  return map[code] ?? 'Algo ha salido mal. Inténtalo de nuevo.';
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

// Reglas de contraseña para signup (signin acepta cualquier password existente).
function validatePasswordStrength(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial.';
  return null;
}

const Landing: React.FC = () => {
  const history = useHistory();
  const { isAuthed, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  // Si ya hay sesión activa, salta directo al dashboard
  useEffect(() => {
    if (!authLoading && isAuthed) history.replace('/app');
  }, [authLoading, isAuthed, history]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (mode === 'signup') {
      const pwdError = validatePasswordStrength(password);
      if (pwdError) {
        setError(pwdError);
        return;
      }
      if (password !== password2) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInEmail(email.trim(), password);
      } else {
        await signUpEmail(email.trim(), password);
        setInfo('Cuenta creada. Te hemos enviado un email de verificación (revisa también la carpeta de spam).');
      }
    } catch (err) {
      setError(translateAuthError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setBusy(true);
    try {
      await signInGoogle();
      // En PWA standalone esto inicia un redirect y la página se descarga
      // antes de llegar al finally. En navegador, el popup completa aquí.
    } catch (err) {
      const code = errorCode(err);
      // El usuario cierra el popup → no es un error real
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(translateAuthError(code));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    clearMessages();
    setBusy(true);
    try {
      await signInGuest();
    } catch (err) {
      setError(translateAuthError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  // Cambia de modo y limpia campos sensibles para evitar arrastrar email
  // o passwords entre flujos distintos (por privacidad y UX limpia).
  const switchMode = (next: Mode) => {
    setMode(next);
    setEmail('');
    setPassword('');
    setPassword2('');
    setShowPwd(false);
    clearMessages();
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="landing-bg">
          <div className="landing-hero">
            <div className="landing-logo-wrap">
              <img src="/logo.png" alt="BTal" className="landing-logo" />
            </div>
          </div>

          <form className="landing-card" onSubmit={handleSubmit}>
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
              />
            </div>

            <div className="landing-input-wrap">
              <IonIcon icon={lockClosedOutline} className="landing-input-icon" />
              <input
                className="landing-input landing-input--password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Contraseña"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : 6}
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

            {mode === 'signup' && (
              <>
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
              </>
            )}

            {error && <div className="landing-msg error">{error}</div>}
            {info && <div className="landing-msg info">{info}</div>}

            <IonButton
              type="submit"
              expand="block"
              className="landing-primary"
              disabled={busy}
            >
              {busy ? (
                <IonSpinner name="dots" />
              ) : mode === 'signin' ? (
                'Entrar'
              ) : (
                'Crear cuenta'
              )}
            </IonButton>

            {mode === 'signin' && (
              <button
                type="button"
                className="landing-link"
                onClick={() => setForgotOpen(true)}
              >
                ¿Has olvidado tu contraseña?
              </button>
            )}

            <div className="landing-divider">o</div>

            <IonButton
              type="button"
              expand="block"
              className="landing-google"
              onClick={handleGoogle}
              disabled={busy}
            >
              <IonIcon icon={logoGoogle} slot="start" />
              Continuar con Google
            </IonButton>

            <button
              type="button"
              className="landing-guest"
              onClick={handleGuest}
              disabled={busy}
            >
              Probar como invitado →
            </button>

            <div className="landing-toggle">
              {mode === 'signin' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('signup')}>
                    Crear cuenta
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('signin')}>
                    Iniciar sesión
                  </button>
                </>
              )}
            </div>
          </form>

          <div className="landing-version">v0.1 · scaffold</div>
        </div>

        <ForgotPasswordModal
          isOpen={forgotOpen}
          initialEmail={email}
          onClose={() => setForgotOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Landing;
