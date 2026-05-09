import { useState, type FormEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import { closeOutline, warningOutline } from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { deleteAccount } from '../services/auth';
import { ReauthModal } from './ReauthModal';
import './SettingsModal.css';
import './DeleteAccountModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/user-not-found': 'La cuenta ya no existe.',
  };
  return map[code] ?? 'No hemos podido eliminar la cuenta. Inténtalo de nuevo.';
}

// Texto-trampa que el usuario debe escribir para habilitar el botón.
// Mayúsculas y sin acentos para evitar autocorrección del teclado móvil.
const CONFIRM_WORD = 'ELIMINAR';

export function DeleteAccountModal({ isOpen, user, onClose }: Props) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reauthOpen, setReauthOpen] = useState(false);

  const resetState = () => {
    setConfirm('');
    setBusy(false);
    setError('');
    setReauthOpen(false);
  };

  const performDelete = async () => {
    setError('');
    setBusy(true);
    try {
      await deleteAccount(user);
      // onAuthStateChanged dispara con null → AuthProvider actualiza →
      // Settings.useEffect redirige a /. El modal se desmonta solo.
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/requires-recent-login') {
        // Sesión vieja → reauth y volvemos a intentar.
        setReauthOpen(true);
      } else {
        setError(translateError(code));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (confirm.trim() !== CONFIRM_WORD) return;
    performDelete();
  };

  const canSubmit = confirm.trim() === CONFIRM_WORD && !busy;

  return (
    <>
      <IonModal
        isOpen={isOpen && !reauthOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <div className="settings-modal-bg">
          <button
            type="button"
            className="settings-modal-close"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <div className="settings-modal-card delete-account-card">
            <div className="delete-account-icon">
              <IonIcon icon={warningOutline} />
            </div>
            <h2 className="settings-modal-title">¿Eliminar tu cuenta?</h2>
            <p className="settings-modal-text">
              Esta acción es <strong>permanente y no se puede deshacer</strong>.
              {!user.isAnonymous && user.email && (
                <>
                  {' '}Borraremos la cuenta asociada a <strong>{user.email}</strong> y todos sus datos.
                </>
              )}
            </p>
            <ul className="delete-account-list">
              <li>Tu perfil y todos tus datos se borrarán.</li>
              <li>Si tienes una suscripción activa, debe cancelarse antes (próximamente).</li>
              <li>No podrás recuperar la cuenta más adelante.</li>
            </ul>

            <form onSubmit={handleSubmit}>
              <label className="delete-account-label" htmlFor="delete-confirm">
                Para confirmar, escribe <code>{CONFIRM_WORD}</code> en mayúsculas:
              </label>
              <input
                id="delete-confirm"
                className="landing-input delete-account-input"
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                maxLength={50}
              />

              {error && <div className="landing-msg error">{error}</div>}

              <div className="delete-account-actions">
                <IonButton
                  type="button"
                  fill="outline"
                  expand="block"
                  className="delete-account-cancel"
                  onClick={onClose}
                  disabled={busy}
                >
                  Cancelar
                </IonButton>
                <IonButton
                  type="submit"
                  expand="block"
                  className="delete-account-confirm"
                  disabled={!canSubmit}
                >
                  {busy ? <IonSpinner name="dots" /> : 'Eliminar cuenta'}
                </IonButton>
              </div>
            </form>
          </div>
        </div>
      </IonModal>

      <ReauthModal
        isOpen={reauthOpen}
        user={user}
        reason="Eliminar tu cuenta es una operación irreversible. Confirma tu identidad para continuar."
        onClose={() => {
          setReauthOpen(false);
          // Si cancela el reauth, dejamos el modal de delete abierto
          // para que pueda decidir o cerrar.
        }}
        onSuccess={() => {
          setReauthOpen(false);
          // Reintentamos el borrado tras la reauth.
          performDelete();
        }}
      />
    </>
  );
}
