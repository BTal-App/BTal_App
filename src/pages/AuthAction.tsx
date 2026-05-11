import { useEffect, useState, type FormEvent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonButton, IonContent, IonPage, IonSpinner } from '@ionic/react';
import { MealIcon } from '../components/MealIcon';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  type ActionCodeInfo,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import './AuthAction.css';

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
  const { refreshUser } = useAuth();
  const params = new URLSearchParams(location.search);
  const oobCode = params.get('oobCode') ?? '';

  const [verifying, setVerifying] = useState(true);
  const [info, setInfo] = useState<ActionCodeInfo | null>(null);
  const [error, setError] = useState('');
  // Mensaje de éxito tras aplicar acciones que se completan automáticamente
  // (verifyEmail, recoverEmail, revertSecondFactorAddition).
  const [successMsg, setSuccessMsg] = useState('');

  // Estado del formulario de reset de contraseña
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode) {
        setError('Enlace no válido. Falta el código de acción.');
        setVerifying(false);
        return;
      }

      try {
        // checkActionCode valida el oobCode SIN aplicarlo y nos devuelve el
        // tipo de operación + los datos asociados (emails antiguo/nuevo, etc.).
        const actionInfo = await checkActionCode(auth, oobCode);
        if (cancelled) return;
        setInfo(actionInfo);

        // Las acciones "auto-aplicables" las completamos aquí mismo.
        // resetPassword se aplica más tarde cuando el usuario envía el form.
        const op = actionInfo.operation;
        if (op === 'VERIFY_EMAIL') {
          await applyActionCode(auth, oobCode);
          // refreshUser: re-lee user del servidor y propaga el cambio a todos
          // los componentes que leen del AuthContext (Dashboard, Settings,
          // AccountInfoModal, ...) para que emailVerified/email actualicen.
          await refreshUser();
          if (!cancelled) setSuccessMsg('Email verificado correctamente.');
        } else if (op === 'RECOVER_EMAIL') {
          await applyActionCode(auth, oobCode);
          await refreshUser();
          if (!cancelled) {
            const restored = actionInfo.data.email;
            setSuccessMsg(
              restored
                ? `Hemos restaurado tu email a ${restored}. Cambia tu contraseña por seguridad.`
                : 'Cambio de email revertido. Cambia tu contraseña por seguridad.',
            );
          }
        } else if (op === 'VERIFY_AND_CHANGE_EMAIL') {
          await applyActionCode(auth, oobCode);
          await refreshUser();
          if (!cancelled) {
            const newEmail = actionInfo.data.email;
            setSuccessMsg(
              newEmail
                ? `Email actualizado a ${newEmail}.`
                : 'Email actualizado correctamente.',
            );
          }
        } else if (op === 'REVERT_SECOND_FACTOR_ADDITION') {
          await applyActionCode(auth, oobCode);
          await refreshUser();
          if (!cancelled) {
            setSuccessMsg(
              'Hemos eliminado el segundo factor de autenticación que se añadió. Cambia tu contraseña por seguridad.',
            );
          }
        }
        // PASSWORD_RESET y EMAIL_SIGNIN se manejan abajo en el render.
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
  }, [oobCode, refreshUser]);

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
      setResetDone(true);
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => history.replace('/');

  // ── Render ────────────────────────────────────────────────────────────────

  let body: React.ReactNode;

  if (verifying) {
    body = (
      <div className="auth-action-loading">
        <IonSpinner name="dots" />
        <p>Verificando enlace…</p>
      </div>
    );
  } else if (error) {
    body = (
      <>
        <h2 className="auth-action-title">Enlace no válido</h2>
        <div className="landing-msg error">{error}</div>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Volver a la landing
        </IonButton>
      </>
    );
  } else if (info?.operation === 'PASSWORD_RESET') {
    body = resetDone ? (
      <>
        <h2 className="auth-action-title">Contraseña actualizada</h2>
        <p className="auth-action-text">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Iniciar sesión
        </IonButton>
      </>
    ) : (
      <>
        <h2 className="auth-action-title">Nueva contraseña</h2>
        {info.data.email && (
          <p className="auth-action-text">
            Para <strong>{info.data.email}</strong>
          </p>
        )}

        <form onSubmit={handleResetSubmit}>
          <div className="landing-input-wrap">
            <MealIcon value="tb:lock" size={18} className="landing-input-icon" />
            <input
              className="landing-input landing-input--password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoFocus
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
    );
  } else if (info?.operation === 'EMAIL_SIGNIN') {
    // Email-link sign-in: lo dejamos para una futura iteración. Por ahora
    // mostramos un mensaje neutro y un botón para volver.
    body = (
      <>
        <h2 className="auth-action-title">Acción no soportada</h2>
        <p className="auth-action-text">
          Este tipo de enlace aún no está disponible. Inicia sesión con tu email y contraseña.
        </p>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Volver
        </IonButton>
      </>
    );
  } else if (info?.operation === 'VERIFY_EMAIL') {
    body = (
      <>
        <h2 className="auth-action-title">Email verificado</h2>
        <div className="landing-msg info">{successMsg}</div>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Continuar
        </IonButton>
      </>
    );
  } else if (info?.operation === 'VERIFY_AND_CHANGE_EMAIL') {
    body = (
      <>
        <h2 className="auth-action-title">Email actualizado</h2>
        <div className="landing-msg info">{successMsg}</div>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Continuar
        </IonButton>
      </>
    );
  } else if (info?.operation === 'RECOVER_EMAIL') {
    body = (
      <>
        <h2 className="auth-action-title">Cuenta recuperada</h2>
        <div className="landing-msg info">{successMsg}</div>
        <p className="auth-action-text">
          Te recomendamos cambiar la contraseña ahora desde "¿Has olvidado tu contraseña?".
        </p>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Ir a la landing
        </IonButton>
      </>
    );
  } else if (info?.operation === 'REVERT_SECOND_FACTOR_ADDITION') {
    body = (
      <>
        <h2 className="auth-action-title">Segundo factor revocado</h2>
        <div className="landing-msg info">{successMsg}</div>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Continuar
        </IonButton>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="auth-action-title">Acción desconocida</h2>
        <p className="auth-action-text">No reconocemos este tipo de enlace.</p>
        <IonButton expand="block" className="auth-action-primary" onClick={goHome}>
          Volver
        </IonButton>
      </>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="auth-action-bg">
          <div className="auth-action-hero">
            <div className="auth-action-logo-wrap">
              <img src="/logo.png" alt="BTal" className="auth-action-logo" />
            </div>
          </div>

          <div className="auth-action-card">{body}</div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthAction;
