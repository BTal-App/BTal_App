import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/auth';

const Dashboard: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();

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
          <div
            style={{
              minHeight: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 32,
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                ¡Hola!
              </h1>
              <p
                style={{
                  color: 'var(--ancen-t-2)',
                  fontSize: '0.88rem',
                  margin: '4px 0 0',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {user.email ?? 'usuario anónimo'}
              </p>
            </div>
            <IonButton
              fill="clear"
              size="small"
              onClick={handleLogout}
              style={{ '--color': 'var(--ancen-t-2)' } as React.CSSProperties}
            >
              <IonIcon icon={logOutOutline} slot="icon-only" />
            </IonButton>
          </div>

          <div
            style={{
              background: 'var(--ancen-surface)',
              border: '1px solid var(--ancen-border)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <h2
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--ancen-t-3)',
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              Próximamente
            </h2>
            <p style={{ color: 'var(--ancen-t-1)', margin: 0, lineHeight: 1.6 }}>
              Aquí va el dashboard del diseño v2 (Hoy / Menú / Compra / Entreno /
              Registro).
              <br />
              <br />
              <span style={{ color: 'var(--ancen-t-2)', fontSize: '0.88rem' }}>
                UID: <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--ancen-cyan)' }}>{user.uid}</code>
              </span>
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
