import { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import {
  checkmarkCircle,
  closeOutline,
  mailOutline,
  refreshOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { sendVerificationEmail } from '../services/auth';
import { useVerifyBanner } from '../hooks/useVerifyBanner';
import './VerifyEmailBanner.css';

interface Props {
  user: User;
  // Identifica desde dónde se muestra el banner. El cierre (X) se persiste
  // por separado para cada `place` — cerrar en "dashboard" no afecta a
  // "settings" ni viceversa.
  place: 'dashboard' | 'settings';
  // Llamado tras user.reload() — el padre debería forzar re-render para
  // que el banner desaparezca si la verificación se completó.
  onRefreshed?: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/too-many-requests':
      'Se ha superado el número máximo de intentos. Por favor, espere unos minutos antes de solicitar un nuevo correo electrónico.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
  };
  return map[code] ?? 'No hemos podido enviar el email. Inténtalo de nuevo.';
}

const dismissKey = (uid: string, place: string) =>
  `btal_verify_dismissed_${uid}_${place}`;

type LocalStage = 'idle' | 'sending' | 'error';

export function VerifyEmailBanner({ user, place, onRefreshed }: Props) {
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
    try {
      await user.reload();
      onRefreshed?.();
    } catch {
      /* el banner se mantiene */
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="verify-banner">
      <div className="verify-banner-icon">
        <IonIcon icon={mailOutline} />
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
                    <IonIcon icon={checkmarkCircle} />
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
                    <IonIcon icon={refreshOutline} />
                    Reenviar
                  </>
                )}
              </button>
            </div>
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
        <IonIcon icon={closeOutline} />
      </button>
    </div>
  );
}
