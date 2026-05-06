import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { cartOutline } from 'ionicons/icons';
import { TabHeader } from '../../components/TabHeader';

// Tab Compra · placeholder de Fase 1.
// En la Fase 3 montaremos: searchbar + categorías colapsables (frutas,
// proteínas, lácteos, hidratos, despensa, suplementación) + items con
// check + precio estimado + FAB para añadir + share list.
//
// La lista se genera a partir del menú semanal en Firestore.
const CompraPage: React.FC = () => {
  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Lista de "
            accent="compra"
            subtitle="Generada a partir de tu menú semanal"
          />

          <div className="app-soon-card">
            <div className="app-soon-icon">
              <IonIcon icon={cartOutline} />
            </div>
            <h3>Pronto aquí</h3>
            <p>
              Tu lista organizada en 6 categorías con barra de progreso por
              categoría, check para marcar lo comprado, precio estimado y
              compartir. Se construye automáticamente desde tu plan nutricional.
            </p>
            <span className="app-soon-tag">Fase 3 · Compra</span>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CompraPage;
