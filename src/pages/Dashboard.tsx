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
import { signOut } from '../services/auth';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  // Si no hay sesión, vuelve al landing
  useEffect(() => {
    if (!loading && !isAuthed) history.replace('/');
  }, [loading, isAuthed, history]);

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
            <div>
              <h1 className="dashboard-greeting">
                ¡Hola!
                {user.isAnonymous && <span className="dashboard-badge">Invitado</span>}
              </h1>
              <p className="dashboard-email">
                {user.isAnonymous ? 'Sesión temporal · sin cuenta' : user.email}
              </p>
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
