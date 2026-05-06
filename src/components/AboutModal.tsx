import { IonIcon, IonModal } from '@ionic/react';
import {
  closeOutline,
  documentTextOutline,
  medkitOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import './SettingsModal.css';
import './AboutModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Inyectado por Vite via define en vite.config.ts (ver paso siguiente).
// Hasta que lo configuremos, fallback a la versión de package.json en build.
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export function AboutModal({ isOpen, onClose }: Props) {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      <div className="settings-modal-bg">
        <button
          type="button"
          className="settings-modal-close"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <div className="settings-modal-card about-card">
          <img src="/logo.png" alt="BTal" className="about-logo" />

          <div className="about-tagline">
            Tu plan de nutrición y entreno, en un solo sitio.
          </div>
          <div className="about-version">v{APP_VERSION}</div>

          <div className="about-links">
            <a
              href="/legal/privacidad"
              className="about-link"
              target="_blank"
              rel="noreferrer"
            >
              <IonIcon icon={shieldCheckmarkOutline} />
              <span>Política de privacidad</span>
            </a>
            <a
              href="/legal/terminos"
              className="about-link"
              target="_blank"
              rel="noreferrer"
            >
              <IonIcon icon={documentTextOutline} />
              <span>Términos de uso</span>
            </a>
            <a
              href="/legal/aviso-medico"
              className="about-link"
              target="_blank"
              rel="noreferrer"
            >
              <IonIcon icon={medkitOutline} />
              <span>Aviso médico</span>
            </a>
          </div>

          <p className="about-credits">
            Hecho con ♥ desde Spain.
            <br />
            <span className="about-credits-mono">© BTal · {new Date().getFullYear()}</span>
          </p>
        </div>
      </div>
    </IonModal>
  );
}
