import { useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { barbellOutline, sparklesOutline } from 'ionicons/icons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { TabHeader } from '../../components/TabHeader';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { blurAndRun } from '../../utils/focus';

// Tab Entreno · placeholder con botón "Generar con IA" prep Fase 6.
// Fase 2D montaremos: plan switcher (3/4/5/6 días + custom) + banner de
// recomendación según diasEntreno del perfil + train days con sus
// ejercicios y series + bottom sheet de detalle.
//
// Botón "Generar con IA" en esta tab solo tiene un scope ('entrenos_only')
// — el AiGenerateModal lo detecta y va directo sin mostrar grid de elección.
const EntrenoPage: React.FC = () => {
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
            title="Plan de "
            accent="entreno"
            right={
              <>
                {showAiButton && (
                  <>
                    <AiGeneratedBadge userDoc={userDoc} scope="entrenos" />
                    <button
                      type="button"
                      className="tab-header-ia-btn"
                      onClick={blurAndRun(() => setAiGenOpen(true))}
                      aria-label="Generar con IA"
                    >
                      <IonIcon icon={sparklesOutline} />
                      <span>Generar con IA</span>
                    </button>
                  </>
                )}
                <AppAvatarButton />
              </>
            }
          />

          <div className="app-soon-card">
            <div className="app-soon-icon">
              <IonIcon icon={barbellOutline} />
            </div>
            <h3>Pronto aquí</h3>
            <p>
              Selector de plan (1–7 días), recomendación según los días que
              hayas declarado en tu perfil, lista de días con sus ejercicios y
              series, y bottom sheet para ver detalles, técnica y sustitutos.
            </p>
            <span className="app-soon-tag">Fase 2D · Entreno</span>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>

        {showAiButton && aiGenOpen && (
          <AiGenerateModal
            isOpen={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            title="Generar el plan de entreno con IA"
            description="Crearemos un plan adaptado a tus días disponibles, equipamiento y objetivo."
            availableScopes={['entrenos_only']}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default EntrenoPage;
