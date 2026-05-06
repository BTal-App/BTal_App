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
import { logOutOutline, settingsOutline } from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { signOut } from '../services/auth';
import { VerifyEmailBanner } from '../components/VerifyEmailBanner';
import { greetingName, initialsOf } from '../utils/userDisplay';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();
  const { profile: userDoc, loading: profileLoading } = useProfile();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  // Si no hay sesión, vuelve al landing
  useEffect(() => {
    if (!loading && !isAuthed) history.replace('/');
  }, [loading, isAuthed, history]);

  // Si el usuario es real (no invitado) y no tiene perfil completo, mándalo al onboarding.
  // Los invitados no pasan por onboarding — ProfileProvider deja profile en null para ellos.
  // Nota: touchLastActive vive en ProfileProvider.load() (después del read del
  // doc) — hacerlo aquí provocaba race condition con la lectura en Firestore,
  // que devolvía solo {lastActive} en vez del doc completo.
  useEffect(() => {
    if (loading || profileLoading || !user) return;
    if (user.isAnonymous) return;
    if (!userDoc?.profile?.completed) {
      history.replace('/onboarding');
    }
  }, [loading, profileLoading, user, userDoc, history]);

  const handleLogout = async () => {
    await signOut();
    // useAuth detectará el cambio y el efecto de arriba redirige
  };

  if (loading || !user) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="dashboard-loading">
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="dashboard-wrap">
          <div className="dashboard-header">
            <div className="dashboard-identity">
              <div className="dashboard-avatar">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" />
                ) : (
                  <span>{initialsOf(user.displayName, user.email)}</span>
                )}
              </div>
              <div>
                <h1 className="dashboard-greeting">
                  {(() => {
                    const name = greetingName(user);
                    return name ? `¡Hola, ${name}!` : '¡Hola!';
                  })()}
                  {user.isAnonymous && <span className="dashboard-badge">Invitado</span>}
                </h1>
                <p className="dashboard-email">
                  {user.isAnonymous ? 'Sesión temporal · sin cuenta' : user.email}
                </p>
              </div>
            </div>
            <div className="dashboard-actions">
              <IonButton
                fill="clear"
                size="small"
                onClick={() => history.push('/settings')}
                className="dashboard-logout"
                aria-label="Ajustes"
              >
                <IonIcon icon={settingsOutline} slot="icon-only" />
              </IonButton>
              <IonButton
                fill="clear"
                size="small"
                onClick={() => setConfirmLogoutOpen(true)}
                className="dashboard-logout"
                aria-label="Cerrar sesión"
              >
                <IonIcon icon={logOutOutline} slot="icon-only" />
              </IonButton>
            </div>
          </div>

          {user.email && !user.emailVerified && !user.isAnonymous && (
            <VerifyEmailBanner user={user} place="dashboard" />
          )}

          <div className="dashboard-card">
            <h2>Próximamente</h2>
            <p>
              Aquí va el dashboard del diseño v2 (Hoy / Menú / Compra / Entreno /
              Registro).
              <br />
              <br />
              <span className="dashboard-uid">
                UID: <code>{user.uid}</code>
              </span>
            </p>
          </div>
        </div>

        <IonAlert
          isOpen={confirmLogoutOpen}
          onDidDismiss={() => setConfirmLogoutOpen(false)}
          header="¿Cerrar sesión?"
          message={
            user.isAnonymous
              ? 'Estás como invitado. Si cierras sesión, perderás los datos de esta prueba.'
              : 'Vas a cerrar sesión en este dispositivo.'
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Cerrar sesión',
              role: 'destructive',
              handler: () => {
                handleLogout();
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
