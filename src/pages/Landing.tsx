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
  resetPassword,
  signInEmail,
  signInGoogle,
  signInGuest,
  signUpEmail,
} from '../services/auth';
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

const Landing: React.FC = () => {
  const history = useHistory();
  const { isAuthed, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInEmail(email.trim(), password);
      } else {
        await signUpEmail(email.trim(), password);
        setInfo('Cuenta creada. Te hemos enviado un email de verificación.');
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

  const handleForgot = async () => {
    if (!email.trim()) {
      setError('Escribe tu email primero y vuelve a pulsar.');
      return;
    }
    clearMessages();
    try {
      await resetPassword(email.trim());
      setInfo('Te hemos enviado un email para restablecer la contraseña.');
    } catch (err) {
      setError(translateAuthError(errorCode(err)));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
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
                minLength={6}
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
              <button type="button" className="landing-link" onClick={handleForgot}>
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
      </IonContent>
    </IonPage>
  );
};

export default Landing;
