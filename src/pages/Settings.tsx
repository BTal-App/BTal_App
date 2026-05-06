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
  chevronForwardOutline,
  helpCircleOutline,
  informationCircleOutline,
  logoGoogle,
  mailOutline,
  pencilOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import {
  getEnrolledTotpFactor,
  hasGoogleProvider,
  isStandalone,
  linkGoogle,
  unenrollTotp,
  unlinkProvider,
} from '../services/auth';
import { AboutModal } from '../components/AboutModal';
import { AccountManageModal } from '../components/AccountManageModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { EnableTotpModal } from '../components/EnableTotpModal';
import { VerifyEmailRow } from '../components/VerifyEmailRow';
import { initialsOf } from '../utils/userDisplay';
import './Settings.css';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Construye el body del email de soporte con datos útiles para diagnóstico.
function buildSupportMailto(
  email: string | null | undefined,
  uid: string,
  subjectPrefix: string,
): string {
  const subject = `${subjectPrefix} BTal`;
  const body = [
    'Hola, equipo de BTal.',
    '',
    '— [Escribe aquí tu mensaje] —',
    '',
    '— Datos para soporte (no edites) —',
    `Email: ${email ?? '(invitado)'}`,
    `UID: ${uid}`,
    `Versión: v${APP_VERSION}`,
    `Plataforma: ${navigator.userAgent}`,
    `Fecha: ${new Date().toISOString()}`,
  ].join('\n');
  return `mailto:soporte@btal.app?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

const Settings: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [accountManageOpen, setAccountManageOpen] = useState(false);
  const [enableTotpOpen, setEnableTotpOpen] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [confirmUnlinkGoogleOpen, setConfirmUnlinkGoogleOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [linkGoogleError, setLinkGoogleError] = useState('');
  // Tick para forzar re-render tras enroll/unenroll/link (los datos están
  // mutados en el objeto user pero no disparan onAuthStateChanged).
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
  const hasGoogle = hasGoogleProvider(user);
  // Forzamos lectura de tick para que el render se actualice tras cambios
  void tick;

  const handleDisableTotp = async () => {
    try {
      await unenrollTotp(user);
      await user.reload();
      refresh();
    } catch (err) {
      console.error('[BTal] unenroll error:', err);
    }
  };

  const handleLinkGoogle = async () => {
    setLinkGoogleError('');
    try {
      await linkGoogle(user);
      await user.reload();
      refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return; // El usuario cerró el popup, no es un error real
      }
      if (code === 'auth/credential-already-in-use') {
        setLinkGoogleError('Esa cuenta de Google ya está vinculada a otra cuenta de BTal.');
      } else if (code === 'auth/provider-already-linked') {
        setLinkGoogleError('Google ya está vinculado a esta cuenta.');
      } else {
        setLinkGoogleError('No hemos podido vincular Google. Inténtalo de nuevo.');
      }
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      await unlinkProvider(user, 'google.com');
      await user.reload();
      refresh();
    } catch (err) {
      console.error('[BTal] unlink google error:', err);
    }
  };

  const supportMailto = buildSupportMailto(user.email, user.uid, '[Soporte]');
  const bugMailto = buildSupportMailto(user.email, user.uid, '[BUG]');

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="settings-wrap">
          <div className="settings-header">
            <button
              type="button"
              className="settings-back"
              onClick={(e) => {
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

          {/* Avatar grande clicable para editar perfil — solo no-invitados */}
          {!isAnonymous && (
            <button
              type="button"
              className="settings-profile-card"
              onClick={() => setEditProfileOpen(true)}
              aria-label="Editar perfil"
            >
              <div className="settings-avatar">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" />
                ) : (
                  <span>{initialsOf(user.displayName, user.email)}</span>
                )}
              </div>
              <div className="settings-profile-info">
                <span className="settings-profile-name">
                  {user.displayName?.trim() || 'Sin nombre'}
                </span>
                <span className="settings-profile-edit">
                  <IonIcon icon={pencilOutline} />
                  Editar perfil
                </span>
              </div>
            </button>
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
            </div>

            {!isAnonymous && user.email && (
              <VerifyEmailRow user={user} onRefreshed={refresh} />
            )}

            {/* Vincular / desvincular Google */}
            {!isAnonymous && (
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-label">Cuenta de Google</span>
                  <span className="settings-row-value settings-row-sub">
                    {hasGoogle
                      ? 'Vinculada · puedes iniciar sesión con Google'
                      : 'Vincúlala para iniciar sesión también con Google'}
                  </span>
                  {!hasGoogle && isStandalone() && (
                    <span className="settings-row-warn">
                      En la app instalada el flujo de Google puede fallar (limitación de iOS PWA).
                      Si no funciona, vincúlala desde el navegador.
                    </span>
                  )}
                  {linkGoogleError && (
                    <span className="settings-row-error">{linkGoogleError}</span>
                  )}
                </div>
                {hasGoogle ? (
                  <IonButton
                    fill="outline"
                    color="danger"
                    size="small"
                    className="settings-row-action"
                    onClick={() => setConfirmUnlinkGoogleOpen(true)}
                  >
                    Desvincular
                  </IonButton>
                ) : (
                  <IonButton
                    fill="outline"
                    size="small"
                    className="settings-row-action"
                    onClick={handleLinkGoogle}
                  >
                    <IonIcon icon={logoGoogle} slot="start" />
                    Vincular
                  </IonButton>
                )}
              </div>
            )}

            {/* Submenu Administrar cuenta — abre AccountManageModal con
                cambiar email, contraseña, restablecer y cerrar sesiones. */}
            {!isAnonymous && (
              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={() => setAccountManageOpen(true)}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Administrar cuenta</span>
                  <span className="settings-row-value settings-row-sub">
                    Cambiar email, contraseña y gestionar sesiones.
                  </span>
                </div>
                <IonIcon icon={chevronForwardOutline} className="settings-row-chevron" />
              </button>
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

          <section className="settings-section">
            <h2 className="settings-section-title">Soporte</h2>

            <a
              href={supportMailto}
              className="settings-row settings-row--link"
              target="_blank"
              rel="noreferrer"
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Contactar soporte</span>
                <span className="settings-row-value settings-row-sub">
                  Te abrimos tu email con asunto y datos pre-rellenados.
                </span>
              </div>
              <IonIcon icon={helpCircleOutline} className="settings-row-chevron" />
            </a>

            <a
              href={bugMailto}
              className="settings-row settings-row--link"
              target="_blank"
              rel="noreferrer"
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Reportar un bug</span>
                <span className="settings-row-value settings-row-sub">
                  Envíanos lo que has visto y cómo reproducirlo.
                </span>
              </div>
              <IonIcon icon={mailOutline} className="settings-row-chevron" />
            </a>

            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={() => setAboutOpen(true)}
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Acerca de BTal</span>
                <span className="settings-row-value settings-row-sub">
                  v{APP_VERSION} · privacidad, términos, aviso médico
                </span>
              </div>
              <IonIcon icon={informationCircleOutline} className="settings-row-chevron" />
            </button>
          </section>

          <section className="settings-section settings-danger">
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

        <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />

        <DeleteAccountModal
          isOpen={deleteAccountOpen}
          user={user}
          onClose={() => setDeleteAccountOpen(false)}
        />

        {!isAnonymous && (
          <>
            <EditProfileModal
              isOpen={editProfileOpen}
              user={user}
              onClose={() => setEditProfileOpen(false)}
              onUpdated={refresh}
            />
            <AccountManageModal
              isOpen={accountManageOpen}
              user={user}
              onClose={() => setAccountManageOpen(false)}
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
            <IonAlert
              isOpen={confirmUnlinkGoogleOpen}
              onDidDismiss={() => setConfirmUnlinkGoogleOpen(false)}
              header="¿Desvincular Google?"
              message="Tu cuenta seguirá funcionando con email y contraseña. Podrás volver a vincular Google cuando quieras."
              buttons={[
                { text: 'Cancelar', role: 'cancel' },
                {
                  text: 'Desvincular',
                  role: 'destructive',
                  handler: () => {
                    handleUnlinkGoogle();
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
