import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import { TabHeader } from '../../components/TabHeader';
import { AppAvatarButton } from '../../components/AppAvatarButton';

// Tab Registro · placeholder de Fase 1.
// En la Fase 5 montaremos: stats grid (racha, este mes, PRs, total
// entrenos) + calendar mensual con días train/rest/PR + tarjeta del día
// seleccionado con los pesos registrados de cada ejercicio.
//
// Todo se persiste en Firestore — históricos por sesión bajo
// /users/{uid}/registros/{fecha} (esquema a definir en Fase 5).
const RegistroPage: React.FC = () => {
  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Registro de "
            accent="pesos"
            right={<AppAvatarButton />}
          />

          <div className="app-soon-card">
            <div className="app-soon-icon">
              <IonIcon icon={calendarOutline} />
            </div>
            <h3>Pronto aquí</h3>
            <p>
              Calendario mensual con tus días entrenados, descansos y PRs.
              Stats grid (racha, días del mes, PRs totales, sesiones desde
              enero) y detalle del día seleccionado con los pesos de cada
              ejercicio.
            </p>
            <span className="app-soon-tag">Fase 5 · Registro</span>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default RegistroPage;
