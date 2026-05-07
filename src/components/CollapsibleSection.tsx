import { useState, type ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { chevronDownOutline } from 'ionicons/icons';
import { blurAndRun } from '../utils/focus';
import './CollapsibleSection.css';

interface Props {
  // Título del header (siempre visible).
  title: string;
  // Subtítulo / descripción opcional.
  subtitle?: string;
  // Pista visual a la derecha del header (ej. "3 añadidos", emoji, etc.).
  badge?: ReactNode;
  // Contenido que se muestra cuando está expandido.
  children: ReactNode;
  // Si arranca expandido o colapsado · default colapsado.
  defaultOpen?: boolean;
}

// Sección plegable. Header pulsable que despliega/colapsa el cuerpo.
// Usado en el paso 4 del onboarding y en EditFitnessProfileModal para
// agrupar campos opcionales (alergias, intolerancias, alimentos, notas).
export function CollapsibleSection({
  title,
  subtitle,
  badge,
  children,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={'collapsible-section' + (open ? ' open' : '')}>
      <button
        type="button"
        className="collapsible-header"
        onClick={blurAndRun(() => setOpen((v) => !v))}
        aria-expanded={open}
      >
        <div className="collapsible-header-text">
          <span className="collapsible-title">{title}</span>
          {subtitle && <span className="collapsible-subtitle">{subtitle}</span>}
        </div>
        {badge && <span className="collapsible-badge">{badge}</span>}
        <IonIcon
          icon={chevronDownOutline}
          className={'collapsible-chevron' + (open ? ' open' : '')}
        />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
