import { IonContent, IonPage } from '@ionic/react';

const Dashboard: React.FC = () => (
  <IonPage>
    <IonContent fullscreen>
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontWeight: 800, letterSpacing: '-.02em' }}>Dashboard</h1>
        <p style={{ color: 'var(--ancen-t-2)' }}>
          Aquí irá el contenido del diseño v2 (Hoy / Menú / Compra / Entreno / Registro).
        </p>
      </div>
    </IonContent>
  </IonPage>
);

export default Dashboard;
