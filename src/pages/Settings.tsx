import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { MealIcon } from '../components/MealIcon';
import { useAuth } from '../hooks/useAuth';
import { useError } from '../hooks/useError';
import { useProfile } from '../hooks/useProfile';
import { AboutModal } from '../components/AboutModal';
import { AccountManageModal } from '../components/AccountManageModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { PreferencesModal } from '../components/PreferencesModal';
import { CONTACT_EMAIL } from '../config/contact';
import { downloadUserDataExport } from '../services/exportData';
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
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

const Settings: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();
  const { profile: userDoc } = useProfile();
  const { showError } = useError();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [accountManageOpen, setAccountManageOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Export GDPR · loading bloquea el botón para evitar disparar dos
  // descargas si el user da doble click, y el toast verde confirma
  // éxito (errores van al canal global `useError`).
  //
  // Flow: click → IonAlert de confirmación que explica QUÉ se descarga
  // (auth + user doc + registros + localStorage local) → "Descargar" o
  // "Cancelar". Sin el alert antes era una descarga sorpresa al primer
  // click — algunos navegadores incluso bloquean popups de descarga sin
  // gesto explícito reciente · ahora hay un opt-in claro del user.
  const [exporting, setExporting] = useState(false);
  const [exportedToast, setExportedToast] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  const handleExportRequest = () => {
    if (!user || exporting) return;
    setExportConfirmOpen(true);
  };

  const handleExportConfirmed = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      await downloadUserDataExport(user, APP_VERSION);
      setExportedToast(true);
    } catch (err) {
      console.error('[Settings] export GDPR', err);
      showError('No hemos podido preparar tus datos. Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };

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
              <MealIcon value="tb:arrow-left" size={22} />
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
                  <span>
                    {initialsOf(
                      userDoc?.profile?.nombre?.trim() || user.displayName,
                      user.email,
                    )}
                  </span>
                )}
              </div>
              <div className="settings-profile-info">
                <span className="settings-profile-name">
                  {userDoc?.profile?.nombre?.trim()
                    || user.displayName?.trim()
                    || 'Sin nombre'}
                </span>
                <span className="settings-profile-edit">
                  <MealIcon value="tb:pencil" size={16} />
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
                <MealIcon value="tb:chevron-right" size={20} className="settings-row-chevron" />
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
              <MealIcon value="tb:adjustments" size={20} className="settings-row-chevron" />
            </button>
          </section>

          {/* Datos · export RGPD · disponible también para invitados
              (sus datos demo también les pertenecen). */}
          <section className="settings-section">
            <h2 className="settings-section-title">Datos</h2>
            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={blurAndRun(handleExportRequest)}
              disabled={exporting}
              aria-busy={exporting}
            >
              <div className="settings-row-info">
                <span className="settings-row-label">Descargar mis datos</span>
                <span className="settings-row-value settings-row-sub">
                  Una copia completa en formato JSON (RGPD).
                </span>
              </div>
              {exporting ? (
                <IonSpinner name="dots" className="settings-row-chevron" />
              ) : (
                <MealIcon value="tb:download" size={20} className="settings-row-chevron" />
              )}
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
              <MealIcon value="tb:help-circle" size={20} className="settings-row-chevron" />
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
              <MealIcon value="tb:mail" size={20} className="settings-row-chevron" />
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
              <MealIcon value="tb:info-circle" size={20} className="settings-row-chevron" />
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

        {/*
          Confirmación previa al export GDPR · explicamos al user EXACTAMENTE
          qué contiene el archivo antes de bajarlo. El JSON descargado puede
          incluir email, perfil físico (peso, altura, etc.), historial
          completo de registros, notas, etc. · no es un archivo trivial y el
          user debe saber qué se está llevando para decidir si quiere
          compartirlo o no. Mensaje espejo del que ya describe la política
          de privacidad (apartado 6 · derecho de portabilidad RGPD art. 20).
        */}
        <IonAlert
          isOpen={exportConfirmOpen}
          onDidDismiss={() => setExportConfirmOpen(false)}
          header="Descargar mis datos"
          subHeader="¿Qué se va a descargar?"
          message={
            'Un archivo JSON con TODOS tus datos de BTal:\n\n'
            + '• Datos de tu cuenta (email, nombre, proveedores de login, fechas de creación y último acceso).\n'
            + '• Tu perfil físico (peso, altura, edad, objetivo, intolerancias, etc.).\n'
            + '• Tus menús de las 7 días, lista de la compra, plan de entreno y suplementación.\n'
            + '• Historial completo de registros de pesos.\n'
            + '• Tus preferencias guardadas (unidades, inicio de semana, etc.).\n\n'
            + 'El archivo viaja solo a tu dispositivo · no se envía a ningún servidor. '
            + 'Trátalo con cuidado: contiene información personal.'
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Descargar',
              role: 'confirm',
              handler: () => {
                handleExportConfirmed().catch((err) =>
                  console.error('[Settings] handleExportConfirmed:', err),
                );
              },
            },
          ]}
        />

        <IonToast
          isOpen={exportedToast}
          message="Datos exportados · revisa tus descargas"
          duration={2500}
          position="top"
          color="success"
          onDidDismiss={() => setExportedToast(false)}
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
