import { useState, type FormEvent } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import {
  closeOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  logoGoogle,
  mailOutline,
  saveOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  isStandalone,
  linkAnonymousAccount,
  linkAnonymousGoogle,
} from '../services/auth';
import { blurAndRun } from '../utils/focus';
import './SettingsModal.css';
import './LinkGuestAccountModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Mensajes de error por código de Firebase Auth.
function translateLinkError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use':
      'Ese email ya tiene una cuenta. Si es tuya, inicia sesión (perderás los cambios del invitado).',
    'auth/credential-already-in-use':
      'Esa cuenta ya está vinculada a otro usuario.',
    'auth/invalid-email': 'Email no válido.',
    'auth/weak-password': 'Contraseña débil (mínimo 6 caracteres).',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
  };
  return map[code] ?? 'No hemos podido crear tu cuenta. Inténtalo de nuevo.';
}

// Misma política de password que en Landing/signup.
function validatePasswordStrength(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial.';
  return null;
}

// Modal "Crea tu cuenta para guardar tus cambios" desde el banner del invitado.
// Bajo el capó usa Firebase Auth `linkWithCredential` / `linkWithPopup` para
// CONSERVAR el uid de la sesión anónima. Eso preserva el doc /users/{uid}
// completo (menú demo + cualquier edición que hubiera hecho).
export function LinkGuestAccountModal({ isOpen, onClose }: Props) {
  const { refreshUser } = useAuth();
  const { refresh: refreshProfile } = useProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  const resetState = () => {
    setEmail('');
    setPassword('');
    setPassword2('');
    setShowPwd(false);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
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
      await linkAnonymousAccount(email.trim(), password);
      // Recargamos user (ya no es anónimo) y profile (sigue existiendo
      // bajo el mismo uid, ahora con isDemo:true pero ya como cuenta real).
      await refreshUser();
      await refreshProfile();
      setSavedToast(true);
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(translateLinkError(code));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await linkAnonymousGoogle();
      // En PWA standalone esto inicia un redirect y la página se descarga
      // antes de llegar al finally. En navegador, el popup completa aquí.
      await refreshUser();
      await refreshProfile();
      setSavedToast(true);
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      // Cancelar el popup no es un error real para el usuario.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(translateLinkError(code));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <button
          type="button"
          className="settings-modal-close settings-modal-close--fixed"
          onClick={blurAndRun(onClose)}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <form className="settings-modal-card" onSubmit={handleSubmit}>
              <h2 className="settings-modal-title">Crea tu cuenta</h2>
              <p className="settings-modal-text">
                Vamos a registrarte sin perder nada.{' '}
                <strong>Todos los cambios que has hecho como invitado se conservarán</strong> en
                tu nueva cuenta — el menú, el plan de entreno, la lista de la
                compra y cualquier ajuste que hayas tocado.
              </p>

              <div className="link-guest-input-wrap">
                <IonIcon icon={mailOutline} className="link-guest-input-icon" />
                <input
                  className="link-guest-input"
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </div>

              <div className="link-guest-input-wrap">
                <IonIcon icon={lockClosedOutline} className="link-guest-input-icon" />
                <input
                  className="link-guest-input link-guest-input--password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  className="link-guest-input-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <IonIcon icon={showPwd ? eyeOffOutline : eyeOutline} />
                </button>
              </div>

              <div className="link-guest-input-wrap">
                <IonIcon icon={lockClosedOutline} className="link-guest-input-icon" />
                <input
                  className="link-guest-input"
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

              <p className="link-guest-hint">
                Mínimo 8 caracteres · 1 mayúscula · 1 número · 1 carácter especial
              </p>

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="submit"
                expand="block"
                className="settings-modal-primary"
                disabled={busy}
              >
                {busy ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={saveOutline} slot="start" />
                    Crear cuenta y guardar
                  </>
                )}
              </IonButton>

              <div className="link-guest-divider">o</div>

              <IonButton
                type="button"
                expand="block"
                className="link-guest-google"
                onClick={blurAndRun(handleGoogle)}
                disabled={busy}
              >
                <IonIcon icon={logoGoogle} slot="start" />
                Continuar con Google
              </IonButton>

              {isStandalone() && (
                <p className="link-guest-warn">
                  En la app instalada el flujo de Google puede fallar (limitación
                  de iOS PWA). Si no funciona, usa email y contraseña aquí o
                  abre la web en el navegador.
                </p>
              )}
            </form>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Cuenta creada · tus cambios se han guardado"
        duration={3000}
        position="bottom"
        color="success"
      />
    </>
  );
}
