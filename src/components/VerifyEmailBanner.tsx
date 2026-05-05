import { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { checkmarkCircle, mailOutline, refreshOutline } from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { sendVerificationEmail } from '../services/auth';
import './VerifyEmailBanner.css';

interface Props {
  user: User;
  // Llamado tras user.reload() — el padre debería forzar re-render para que
  // el banner desaparezca si la verificación se completó.
  onRefreshed?: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos antes de pedir otro email.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
  };
  return map[code] ?? 'No hemos podido enviar el email. Inténtalo de nuevo.';
}

type Stage = 'idle' | 'sending' | 'sent' | 'error';

export function VerifyEmailBanner({ user, onRefreshed }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleSend = async () => {
    setError('');
    setStage('sending');
    try {
      await sendVerificationEmail(user);
      setStage('sent');
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
      // ignoramos; el banner se mantiene
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
        {stage === 'sent' ? (
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
                    Ya lo he verificado
                  </>
                )}
              </button>
              <button
                type="button"
                className="verify-banner-link verify-banner-link--ghost"
                onClick={handleSend}
              >
                <IonIcon icon={refreshOutline} />
                Reenviar
              </button>
            </div>
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
    </div>
  );
}
