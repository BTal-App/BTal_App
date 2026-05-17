import { useState } from 'react';
import { IonSpinner } from '@ionic/react';
import { MealIcon } from './MealIcon';
import { auth } from '../services/firebase';
import type { User } from 'firebase/auth';
import { sendVerificationEmail } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import { useVerifyBanner } from '../hooks/useVerifyBanner';
import './VerifyEmailBanner.css';

interface Props {
  user: User;
  // Identifica desde dónde se muestra el banner. El cierre (X) se persiste
  // por separado para cada `place` — cerrar en "dashboard" no afecta a
  // "settings" ni viceversa.
  place: 'dashboard' | 'settings';
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/too-many-requests':
      'Se ha superado el número máximo de intentos. Por favor, espere unos minutos antes de solicitar un nuevo correo electrónico.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
  };
  return map[code] ?? 'No se ha podido enviar el email de verificación. Inténtalo de nuevo.';
}

const dismissKey = (uid: string, place: string) =>
  `btal_verify_dismissed_${uid}_${place}`;

type LocalStage = 'idle' | 'sending' | 'error';

export function VerifyEmailBanner({ user, place }: Props) {
  const { refreshUser } = useAuth();
  const { sent, markSent } = useVerifyBanner();

  // Cierre local — se persiste por usuario+place. Lazy init: leemos
  // localStorage solo en el primer render.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey(user.uid, place)) === '1';
    } catch {
      return false;
    }
  });

  const [stage, setStage] = useState<LocalStage>('idle');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Feedback cuando el user pulsa "Confirmar verificación" PERO el server
  // sigue diciendo emailVerified=false (no ha clickeado el enlace del
  // email aún). Sin esto el botón parecía "no hacer nada". El mensaje se
  // limpia automáticamente al disparar otra acción (reenviar, refresh).
  const [notVerifiedYet, setNotVerifiedYet] = useState(false);

  // Si ya está cerrado o el email ya está verificado, no renderizamos nada.
  if (dismissed || user.emailVerified) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissKey(user.uid, place), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const handleSend = async () => {
    setError('');
    setNotVerifiedYet(false);
    setStage('sending');
    try {
      await sendVerificationEmail(user);
      markSent();
      setStage('idle');
    } catch (err) {
      setError(translateError(errorCode(err)));
      setStage('error');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setNotVerifiedYet(false);
    try {
      // refreshUser propaga el cambio (emailVerified) al AuthContext;
      // el banner desaparece automáticamente si user.emailVerified pasa a
      // true. Si tras el reload Firebase sigue diciendo NO verificado,
      // damos feedback visual al user para que sepa qué hacer (el banner
      // sigue ahí porque la verificación del server NO ha ocurrido aún).
      await refreshUser();
      // Comprobamos contra auth.currentUser (no contra `user` prop, que
      // viene del Provider y aún no se ha re-renderizado en este tick).
      if (!auth.currentUser?.emailVerified) {
        setNotVerifiedYet(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="verify-banner">
      <div className="verify-banner-icon">
        <MealIcon value="tb:mail" size={20} />
      </div>
      <div className="verify-banner-content">
        {sent ? (
          <>
            <p className="verify-banner-title">Email enviado a {user.email}</p>
            <p className="verify-banner-text">
              Revisa tu bandeja (y la carpeta de spam) y haz click en el enlace para verificar tu cuenta.
            </p>
            <div className="verify-banner-actions">
              <button
                type="button"
                className="verify-banner-link"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <MealIcon value="tb:circle-check-filled" size={16} />
                    Confirmar verificación
                  </>
                )}
              </button>
              <button
                type="button"
                className="verify-banner-link verify-banner-link--ghost"
                onClick={handleSend}
                disabled={stage === 'sending'}
              >
                {stage === 'sending' ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <MealIcon value="tb:refresh" size={16} />
                    Reenviar
                  </>
                )}
              </button>
            </div>
            {notVerifiedYet && (
              <p className="verify-banner-pending">
                Aún no detectamos la verificación. ¿Has hecho click en el enlace del email?
              </p>
            )}
            {error && <p className="verify-banner-error">{error}</p>}
          </>
        ) : (
          <>
            <p className="verify-banner-title">Verifica tu cuenta de email</p>
            <p className="verify-banner-text">
              Te enviaremos un enlace a <strong>{user.email}</strong> para confirmar que es tuyo.
            </p>
            {error && <p className="verify-banner-error">{error}</p>}
            <button
              type="button"
              className="verify-banner-action"
              onClick={handleSend}
              disabled={stage === 'sending'}
            >
              {stage === 'sending' ? <IonSpinner name="dots" /> : 'Verificar'}
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="verify-banner-close"
        onClick={(e) => {
          e.currentTarget.blur();
          handleDismiss();
        }}
        aria-label="Cerrar aviso de verificación"
      >
        <MealIcon value="tb:x" size={18} />
      </button>
    </div>
  );
}
