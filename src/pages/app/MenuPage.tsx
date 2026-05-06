import { useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { restaurantOutline, sparklesOutline } from 'ionicons/icons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { TabHeader } from '../../components/TabHeader';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { blurAndRun } from '../../utils/focus';

// Tab Menú · placeholder de Fase 1 con botón "Generar con IA" prep Fase 6.
// En la Fase 2B montaremos: day segment scrollable (lun-dom) + ring de
// progreso del día + lista de comidas con sus macros + bottom sheet
// de detalle al pulsar una comida + FAB para añadir.
//
// El botón "Generar con IA" solo aparece si el user es real (no invitado)
// y eligió modo='ai'. Las opciones de scope son: menú+compra o solo menú.
const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [aiGenOpen, setAiGenOpen] = useState(false);

  const showAiButton =
    !!user && !user.isAnonymous && userDoc?.profile?.modo === 'ai';

  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Plan "
            accent="nutricional"
            subtitle="Tu menú semanal generado por IA"
            right={
              showAiButton ? (
                <button
                  type="button"
                  className="tab-header-ia-btn"
                  onClick={blurAndRun(() => setAiGenOpen(true))}
                  aria-label="Generar con IA"
                >
                  <IonIcon icon={sparklesOutline} />
                  <span>Generar con IA</span>
                </button>
              ) : undefined
            }
          />

          <div className="app-soon-card">
            <div className="app-soon-icon">
              <IonIcon icon={restaurantOutline} />
            </div>
            <h3>Pronto aquí</h3>
            <p>
              Tu plan semanal con desayuno, comida, merienda y cena para los 7
              días. Edición inline, totales por día y bottom sheet de detalle
              al pulsar una comida. Conectaremos con Firestore al activar el
              generador.
            </p>
            <span className="app-soon-tag">Fase 2B · Menú</span>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>

        {/* Modal de generación · solo se monta cuando se abre. Las dos
            opciones disponibles en esta tab son menú+compra y solo menú
            (el roadmap excluye explícitamente "todo" y "solo entrenos"
            de la tab de nutrición). Pasamos el aiScope del perfil — si
            ese scope no es uno de los dos disponibles aquí, el modal
            cae al primero (menu_compra). */}
        {showAiButton && aiGenOpen && (
          <AiGenerateModal
            isOpen={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            title="Generar el menú con IA"
            description="¿Quieres también la lista de la compra?"
            availableScopes={['menu_compra', 'menu_only']}
            defaultScope={userDoc?.profile?.aiScope ?? undefined}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default MenuPage;
