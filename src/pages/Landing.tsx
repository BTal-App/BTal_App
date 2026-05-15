import { useEffect, useState, type FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import { logoGoogle } from 'ionicons/icons';
import { MealIcon } from '../components/MealIcon';
import { getMultiFactorResolver, type MultiFactorResolver } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  signInEmail,
  signInGoogle,
  signInGuest,
  signUpEmail,
} from '../services/auth';
import { seedGuestDocument } from '../services/db';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { TotpSignInModal } from '../components/TotpSignInModal';
import './Landing.css';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

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
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);

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
        // El email de verificación NO se envía aquí — se envía cuando el
        // usuario pulsa "Verificar" en el banner del dashboard.
        setInfo('Cuenta creada. En el dashboard podrás verificar tu email.');
      }
    } catch (err) {
      const code = errorCode(err);
      // Si la cuenta tiene MFA activado, Firebase lanza este código.
      // Sacamos el resolver del error y abrimos el modal de TOTP.
      if (code === 'auth/multi-factor-auth-required') {
        setMfaResolver(getMultiFactorResolver(auth, err as Parameters<typeof getMultiFactorResolver>[1]));
      } else {
        setError(translateAuthError(code));
      }
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

  // Estado de la alerta de aviso TTL · se abre al pulsar "Probar como
  // invitado" y solo procede al sign-in tras confirmación explícita.
  // Necesario porque la cuenta de invitado caduca a los 3 días de
  // inactividad y queremos que el user lo sepa antes (no sea sorpresa
  // si vuelve la semana siguiente y todo ha desaparecido).
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);

  const handleGuest = () => {
    clearMessages();
    setGuestWarningOpen(true);
  };

  const proceedAsGuest = async () => {
    setGuestWarningOpen(false);
    setBusy(true);
    try {
      const cred = await signInGuest();
      // Sembramos el documento del invitado con `demoUser` para que la
      // app cargue con un plan de ejemplo navegable. Es idempotente: si
      // el invitado ya tenía doc de una sesión anterior, no lo pisa.
      // useAuth detecta el sign-in y redirige a /app vía useEffect, así
      // que tenemos que asegurar que el doc existe ANTES de que la
      // navegación dispare la carga del shell.
      await seedGuestDocument(cred.user.uid);
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

  // Mientras Firebase restaura la sesión persistida (cold start de PWA ·
  // puede tardar varios segundos en standalone iOS leyendo IndexedDB)
  // mostramos un splash con el logo en vez del formulario de login. Sin
  // esto, el user veía la pantalla de "Iniciar sesión" ~5s y luego saltaba
  // al dashboard de golpe (parecía que se había deslogueado). También
  // cubrimos `isAuthed` ya resuelto pero con el redirect del useEffect aún
  // pendiente · evita el flash del form en ese tick intermedio.
  if (authLoading || isAuthed) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="landing-bg landing-bg--loading">
            <div className="landing-logo-wrap">
              <img src="/logo.png" alt="BTal" className="landing-logo" />
            </div>
            <IonSpinner name="dots" className="landing-loading-spinner" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

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
              <MealIcon value="tb:mail" size={18} className="landing-input-icon" />
              <input
                className="landing-input"
                type="email"
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </div>

            <div className="landing-input-wrap">
              <MealIcon value="tb:lock" size={18} className="landing-input-icon" />
              <input
                className="landing-input landing-input--password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Contraseña"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : 6}
                maxLength={128}
              />
              <button
                type="button"
                className="landing-input-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <MealIcon value={showPwd ? 'tb:eye-off' : 'tb:eye'} size={18} />
              </button>
            </div>

            {mode === 'signup' && (
              <>
                <div className="landing-input-wrap">
                  <MealIcon value="tb:lock" size={18} className="landing-input-icon" />
                  <input
                    className="landing-input"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Confirmar contraseña"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
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

          <div className="landing-version">v{APP_VERSION}</div>
        </div>

        <IonAlert
          isOpen={guestWarningOpen}
          onDidDismiss={() => setGuestWarningOpen(false)}
          header="Modo prueba"
          subHeader="Esta cuenta de invitado caducará en 3 días"
          message={
            'A continuación, vas a probar la app con datos de ejemplo ya '
            + 'precargados. Esta sesión se mantendrá activa durante 3 días. '
            + 'Si pasado ese tiempo no has creado/vinculado una cuenta real, '
            + 'todos los datos se borrarán permanentemente.'
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Entendido, entrar', handler: proceedAsGuest },
          ]}
        />

        <ForgotPasswordModal
          isOpen={forgotOpen}
          initialEmail={email}
          onClose={() => setForgotOpen(false)}
        />

        <TotpSignInModal
          isOpen={mfaResolver !== null}
          resolver={mfaResolver}
          onClose={() => setMfaResolver(null)}
          onSuccess={() => {
            setMfaResolver(null);
            // useAuth detecta el sign-in y redirige a /app vía useEffect.
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Landing;
