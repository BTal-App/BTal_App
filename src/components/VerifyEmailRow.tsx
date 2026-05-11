import { useState } from 'react';
import { IonButton, IonSpinner } from '@ionic/react';
import { MealIcon } from './MealIcon';
import type { User } from 'firebase/auth';
import { sendVerificationEmail } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import { useVerifyBanner } from '../hooks/useVerifyBanner';
import './VerifyEmailRow.css';

interface Props {
  user: User;
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

type Stage = 'idle' | 'sending' | 'error';

export function VerifyEmailRow({ user }: Props) {
  const { refreshUser } = useAuth();
  const { sent, markSent } = useVerifyBanner();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const verified = user.emailVerified;

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
      // refreshUser hace user.reload() y propaga el cambio a todos los
      // consumidores del AuthContext (Dashboard, AccountInfoModal...).
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (verified) {
    return (
      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Verificar email</span>
          <span className="settings-row-value settings-row-sub">
            Tu email ha sido confirmado.
          </span>
        </div>
        <div className="verify-row-status verify-row-status--ok">
          <MealIcon value="tb:circle-check-filled" size={16} />
          Email verificado
        </div>
      </div>
    );
  }

  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">Verificar email</span>
        <span className="settings-row-value settings-row-sub">
          {sent
            ? `Email enviado a ${user.email}. Revisa tu bandeja (y la carpeta de spam).`
            : 'Confirma que este email es tuyo para activar tu cuenta.'}
        </span>
        {error && <span className="verify-row-error">{error}</span>}
      </div>

      {sent ? (
        <div className="verify-row-actions">
          <IonButton
            fill="outline"
            size="small"
            className="settings-row-action"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <IonSpinner name="dots" />
            ) : (
              <>
                <MealIcon value="tb:circle-check-filled" size={16} slot="start" />
                Confirmar verificación
              </>
            )}
          </IonButton>
          <button
            type="button"
            className="verify-row-link"
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
      ) : (
        <IonButton
          fill="outline"
          size="small"
          className="settings-row-action"
          onClick={handleSend}
          disabled={stage === 'sending'}
        >
          {stage === 'sending' ? (
            <IonSpinner name="dots" />
          ) : (
            <>
              <MealIcon value="tb:mail" size={16} slot="start" />
              Enviar email de verificación
            </>
          )}
        </IonButton>
      )}
    </div>
  );
}
