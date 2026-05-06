import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  arrowBackOutline,
  chevronForwardOutline,
  helpCircleOutline,
  informationCircleOutline,
  mailOutline,
  optionsOutline,
  pencilOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { AboutModal } from '../components/AboutModal';
import { AccountManageModal } from '../components/AccountManageModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { PreferencesModal } from '../components/PreferencesModal';
import { blurAndRun } from '../utils/focus';
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
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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

          {/* Avatar grande clickable para editar perfil — solo no-invitados */}
          {!isAnonymous && (
            <button
              type="button"
              className="settings-profile-card"
              onClick={blurAndRun(() => setEditProfileOpen(true))}
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

          {/* Único entry-point para todo lo de cuenta y seguridad */}
          {!isAnonymous && (
            <section className="settings-section">
              <button
                type="button"
                className="settings-row settings-row--link"
                onClick={blurAndRun(() => setAccountManageOpen(true))}
              >
                <div className="settings-row-info">
                  <span className="settings-row-label">Administrar cuenta</span>
                  <span className="settings-row-value settings-row-sub">
                    Cuenta · Seguridad · Eliminar cuenta
                  </span>
                </div>
                <IonIcon icon={chevronForwardOutline} className="settings-row-chevron" />
              </button>
            </section>
          )}

          {/* Preferencias · disponible también para invitados (es local) */}
          <section className="settings-section">
            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={blurAndRun(() => setPreferencesOpen(true))}
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Preferencias</span>
                <span className="settings-row-value settings-row-sub">
                  Sistema de unidades · inicio de la semana
                </span>
              </div>
              <IonIcon icon={optionsOutline} className="settings-row-chevron" />
            </button>
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
              onClick={blurAndRun(() => setAboutOpen(true))}
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

          {/* Eliminar cuenta accesible directamente solo para invitados —
              los usuarios reales lo tienen dentro de "Administrar cuenta". */}
          {isAnonymous && (
            <section className="settings-section settings-danger">
              <div className="settings-row settings-row--danger">
                <div className="settings-row-info">
                  <span className="settings-row-label">Eliminar cuenta</span>
                  <span className="settings-row-value settings-row-sub">
                    Borra esta sesión de invitado. Perderás los datos al instante.
                  </span>
                </div>
                <IonButton
                  fill="outline"
                  color="danger"
                  size="small"
                  className="settings-row-action"
                  onClick={blurAndRun(() => setDeleteAccountOpen(true))}
                >
                  Eliminar cuenta
                </IonButton>
              </div>
            </section>
          )}
        </div>

        <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
        <PreferencesModal
          isOpen={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
        />

        {/* DeleteAccountModal aquí solo se usa para invitados (los registrados
            lo abren desde dentro de AccountManageModal). */}
        {isAnonymous && (
          <DeleteAccountModal
            isOpen={deleteAccountOpen}
            user={user}
            onClose={() => setDeleteAccountOpen(false)}
          />
        )}

        {!isAnonymous && (
          <>
            <EditProfileModal
              isOpen={editProfileOpen}
              user={user}
              onClose={() => setEditProfileOpen(false)}
            />
            <AccountManageModal
              isOpen={accountManageOpen}
              user={user}
              onClose={() => setAccountManageOpen(false)}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Settings;
