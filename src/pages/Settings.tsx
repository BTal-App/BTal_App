import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  arrowBackOutline,
  checkmarkCircle,
  mailOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { getEnrolledTotpFactor, unenrollTotp } from '../services/auth';
import { ChangeEmailModal } from '../components/ChangeEmailModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { EnableTotpModal } from '../components/EnableTotpModal';
import { VerifyEmailRow } from '../components/VerifyEmailRow';
import './Settings.css';

const Settings: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();

  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [enableTotpOpen, setEnableTotpOpen] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  // Tick para forzar re-render tras enroll/unenroll (multiFactor data está
  // en el objeto user pero los enrolledFactors no lanzan onAuthStateChanged).
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Si no hay sesión, vuelve al landing
  useEffect(() => {
    if (!loading && !isAuthed) history.replace('/');
  }, [loading, isAuthed, history]);

  if (loading || !user) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="settings-loading">
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isAnonymous = user.isAnonymous;
  const enrolledTotp = getEnrolledTotpFactor(user);
  // Forzamos lectura de tick para que el render se actualice tras enroll/unenroll
  void tick;

  const handleDisableTotp = async () => {
    try {
      await unenrollTotp(user);
      // Recargamos el user para que enrolledFactors se vacíe
      await user.reload();
      refresh();
    } catch (err) {
      console.error('[BTal] unenroll error:', err);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="settings-wrap">
          <div className="settings-header">
            <button
              type="button"
              className="settings-back"
              onClick={(e) => {
                // Quitamos el foco antes de navegar — Ionic marca la página
                // saliente con aria-hidden, y un foco activo dentro de un
                // ancestro aria-hidden lanza warning de accesibilidad.
                e.currentTarget.blur();
                history.goBack();
              }}
              aria-label="Volver"
            >
              <IonIcon icon={arrowBackOutline} />
            </button>
            <h1 className="settings-title">Ajustes</h1>
          </div>

          {isAnonymous && (
            <div className="settings-banner">
              Estás como invitado. Para gestionar tu cuenta, regístrate o inicia sesión con email.
            </div>
          )}

          <section className="settings-section">
            <h2 className="settings-section-title">Cuenta</h2>

            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Email</span>
                <span className="settings-row-value">
                  {user.email ?? 'Sin email (invitado)'}
                  {!isAnonymous && user.emailVerified && (
                    <IonIcon
                      icon={checkmarkCircle}
                      style={{ color: 'var(--btal-cyan)', marginLeft: 6, verticalAlign: 'middle' }}
                      aria-label="Verificado"
                    />
                  )}
                </span>
              </div>
              {!isAnonymous && (
                <IonButton
                  fill="outline"
                  size="small"
                  className="settings-row-action"
                  onClick={() => setChangeEmailOpen(true)}
                >
                  <IonIcon icon={mailOutline} slot="start" />
                  Cambiar
                </IonButton>
              )}
            </div>

            {!isAnonymous && user.email && (
              <VerifyEmailRow user={user} onRefreshed={refresh} />
            )}
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Seguridad</h2>

            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Verificación en dos pasos (TOTP)</span>
                <span className="settings-row-value settings-row-sub">
                  {enrolledTotp
                    ? 'Activada · te pediremos el código al iniciar sesión'
                    : 'Añade una capa extra de seguridad con tu app authenticator'}
                </span>
              </div>
              {!isAnonymous && (
                enrolledTotp ? (
                  <IonButton
                    fill="outline"
                    color="danger"
                    size="small"
                    className="settings-row-action"
                    onClick={() => setConfirmDisableOpen(true)}
                  >
                    Desactivar
                  </IonButton>
                ) : (
                  <IonButton
                    fill="outline"
                    size="small"
                    className="settings-row-action"
                    onClick={() => setEnableTotpOpen(true)}
                  >
                    <IonIcon icon={shieldCheckmarkOutline} slot="start" />
                    Activar
                  </IonButton>
                )
              )}
            </div>
          </section>

          <section className="settings-section settings-danger">
            <h2 className="settings-section-title">Zona de peligro</h2>

            <div className="settings-row settings-row--danger">
              <div className="settings-row-info">
                <span className="settings-row-label">Eliminar cuenta</span>
                <span className="settings-row-value settings-row-sub">
                  {isAnonymous
                    ? 'Borra esta sesión de invitado. Perderás los datos al instante.'
                    : 'Borra tu cuenta de forma permanente. Esta acción no se puede deshacer.'}
                </span>
              </div>
              <IonButton
                fill="outline"
                color="danger"
                size="small"
                className="settings-row-action"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Eliminar cuenta
              </IonButton>
            </div>
          </section>
        </div>

        <DeleteAccountModal
          isOpen={deleteAccountOpen}
          user={user}
          onClose={() => setDeleteAccountOpen(false)}
        />

        {!isAnonymous && (
          <>
            <ChangeEmailModal
              isOpen={changeEmailOpen}
              user={user}
              onClose={() => setChangeEmailOpen(false)}
            />
            <EnableTotpModal
              isOpen={enableTotpOpen}
              user={user}
              onClose={() => setEnableTotpOpen(false)}
              onEnrolled={refresh}
            />
            <IonAlert
              isOpen={confirmDisableOpen}
              onDidDismiss={() => setConfirmDisableOpen(false)}
              header="¿Desactivar 2FA?"
              message="Tu cuenta volverá a usar solo email y contraseña para iniciar sesión. Podrás reactivarla en cualquier momento."
              buttons={[
                { text: 'Cancelar', role: 'cancel' },
                {
                  text: 'Desactivar',
                  role: 'destructive',
                  handler: () => {
                    handleDisableTotp();
                  },
                },
              ]}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Settings;
