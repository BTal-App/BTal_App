import { IonModal } from '@ionic/react';
import { LegalLink } from './LegalLink';
import { MealIcon } from './MealIcon';
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
        <div className="settings-modal-card about-card">
          {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
          <button
            type="button"
            className="settings-modal-close"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <MealIcon value="tb:x" size={22} />
          </button>
          <img src="/logo.png" alt="BTal" className="about-logo" />

          <div className="about-tagline">
            Tu plan de nutrición y entreno, en un solo sitio.
          </div>
          <div className="about-version">v{APP_VERSION}</div>

          <div className="about-links">
            <LegalLink slug="privacidad" className="about-link">
              <MealIcon value="tb:shield-check" size={20} />
              <span>Política de privacidad</span>
            </LegalLink>
            <LegalLink slug="terminos" className="about-link">
              <MealIcon value="tb:file-text" size={20} />
              <span>Términos de uso</span>
            </LegalLink>
            <LegalLink slug="aviso-medico" className="about-link">
              <MealIcon value="tb:first-aid-kit" size={20} />
              <span>Aviso médico</span>
            </LegalLink>
          </div>

          <p className="about-credits">
            <span className="about-credits-mono">© BTal · {new Date().getFullYear()}</span>
          </p>
        </div>
      </div>
    </IonModal>
  );
}
