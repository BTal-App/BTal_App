import { useState, type ReactNode } from 'react';
import { IonModal } from '@ionic/react';
import { LegalContent } from '../pages/LegalPlaceholder';
import { getLegalTitle, type LegalSlug } from '../pages/legalTypes';
import { MealIcon } from './MealIcon';
import './LegalLink.css';

interface LegalLinkProps {
  slug: LegalSlug;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

// Botón que abre el documento legal (privacidad / términos / aviso-medico) en
// un IonModal in-place · NO navega ni abre tab nueva. Usado en Onboarding
// (link inline) y AboutModal (rows con icono). Mismo UX en web, PWA y futuro
// Capacitor native · sustituye al pattern previo de `<a target="_blank">`.
//
// Los links internos del documento legal (p.ej. términos → privacidad) usan
// LegalCrossLinkContext para swap del slug del modal sin cerrar la vista.
export function LegalLink({
  slug,
  className,
  ariaLabel,
  children,
}: LegalLinkProps) {
  const [open, setOpen] = useState(false);
  const [currentSlug, setCurrentSlug] = useState<LegalSlug>(slug);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentSlug(slug);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={className ?? 'legal-inline-link'}
        onClick={handleOpen}
        aria-label={ariaLabel}
      >
        {children}
      </button>
      <IonModal
        isOpen={open}
        onDidDismiss={() => setOpen(false)}
        className="settings-modal"
      >
        <div className="settings-modal-bg">
          <div className="settings-modal-card legal-modal-card">
            <div className="legal-modal-header">
              <h2 className="legal-modal-title">{getLegalTitle(currentSlug)}</h2>
              <button
                type="button"
                className="settings-modal-close"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setOpen(false);
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
            </div>
            <div className="legal-modal-scroll">
              <LegalContent
                slug={currentSlug}
                onCrossLinkClick={setCurrentSlug}
              />
            </div>
          </div>
        </div>
      </IonModal>
    </>
  );
}
