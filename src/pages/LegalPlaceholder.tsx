import { useHistory, useParams } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import './LegalPlaceholder.css';

const TITLES: Record<string, string> = {
  privacidad: 'Política de privacidad',
  terminos: 'Términos de uso',
  'aviso-medico': 'Aviso médico',
};

const LegalPlaceholder: React.FC = () => {
  const history = useHistory();
  const { slug = '' } = useParams<{ slug: string }>();
  const title = TITLES[slug] ?? 'Documento legal';

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="legal-wrap">
          <div className="legal-header">
            <button
              type="button"
              className="settings-back"
              onClick={(e) => {
                e.currentTarget.blur();
                if (history.length > 1) history.goBack();
                else history.replace('/');
              }}
              aria-label="Volver"
            >
              <IonIcon icon={arrowBackOutline} />
            </button>
            <h1 className="legal-title">{title}</h1>
          </div>

          <div className="legal-body">
            <p>Documento en redacción.</p>
            <p>
              Este texto se completará antes del lanzamiento público con la versión definitiva
              {slug === 'privacidad' && ' adaptada a GDPR'}
              {slug === 'aviso-medico' &&
                ' para indicar que la app no sustituye consejo médico ni profesional'}
              .
            </p>
            <p className="legal-note">
              Si tienes dudas mientras tanto, escribe a{' '}
              <a href="mailto:soporte@btal.app">soporte@btal.app</a>.
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LegalPlaceholder;
