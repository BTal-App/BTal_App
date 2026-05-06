import type { ReactNode } from 'react';
import './TabHeader.css';

interface Props {
  // Título grande tipo "Hola, Pablo" o "Plan nutricional".
  title: string;
  // Trozo del título resaltado en lima (al final). Si lo omites no se resalta.
  // Ej: title="Hola, " accent="Pablo" → "Hola, Pablo" con Pablo en lima.
  accent?: string;
  // Subtítulo pequeño debajo (fecha, contador, etc.).
  subtitle?: ReactNode;
  // Slot derecho · ej: streak pill + avatar, o un IonButton.
  right?: ReactNode;
  // Por defecto los títulos van en MAYÚSCULAS (decisión de producto).
  // Pasa `uppercase={false}` para mantener el texto tal cual lo escribes
  // (caso del saludo "Hola, Pablo" en la tab Hoy, que debe ir en sentence
  // case por sensación de cercanía).
  uppercase?: boolean;
}

// Header personalizado que comparten todas las tabs del shell v2.
// No usa IonHeader/IonToolbar porque el diseño manda colocarlo dentro del
// IonContent (sin la sombra/separador que añade IonHeader) y porque ya
// gestionamos el safe-area-inset-top desde CSS.
export function TabHeader({
  title,
  accent,
  subtitle,
  right,
  uppercase = true,
}: Props) {
  const titleClass =
    'tab-header-title' + (uppercase ? '' : ' tab-header-title--natural');
  return (
    <header className="tab-header">
      <div className="tab-header-text">
        <h1 className={titleClass}>
          {title}
          {accent && <span className="tab-header-accent">{accent}</span>}
        </h1>
        {subtitle && <div className="tab-header-subtitle">{subtitle}</div>}
      </div>
      {right && <div className="tab-header-right">{right}</div>}
    </header>
  );
}
