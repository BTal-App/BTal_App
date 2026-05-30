import { useState } from 'react';
import { IonAlert } from '@ionic/react';
import { MealIcon } from './MealIcon';
import type { UserDocument } from '../templates/defaultUser';
import './AiGeneratedBadge.css';

// Qué timestamp mostrar:
//   - 'menu'     → solo el último del menú (se usa en MenuPage)
//   - 'entrenos' → solo el último de los planes de entreno (EntrenoPage)
//   - 'any'      → el más reciente de los dos (HoyPage · el programa entero)
type BadgeScope = 'menu' | 'entrenos' | 'any';

interface Props {
  userDoc: UserDocument | null;
  scope: BadgeScope;
}

const SCOPE_LABEL: Record<BadgeScope, string> = {
  menu: 'Menú',
  entrenos: 'Entreno',
  any: 'Programa',
};

// Sustantivo para el texto del alert: "Tu menú/entreno/programa se generó…".
const SCOPE_NOUN: Record<BadgeScope, string> = {
  menu: 'menú',
  entrenos: 'entreno',
  any: 'programa',
};

// Chip/botón que se muestra junto al botón "Generar con IA" cuando ya hay
// una generación previa para ese scope. Texto: "[scope] · [fecha]". Al
// pulsarlo abre un alert con la fecha + hora exactas de la generación.
//
// Si nunca se ha generado nada (timestamp null), devuelve null y no se
// renderiza · así el botón Generar se queda solo y limpio.
export function AiGeneratedBadge({ userDoc, scope }: Props) {
  // Hook ANTES de cualquier early return (rules-of-hooks).
  const [infoOpen, setInfoOpen] = useState(false);

  if (!userDoc) return null;
  const g = userDoc.generaciones;

  let timestamp: number | null;
  if (scope === 'menu') {
    timestamp = g.menu_at;
  } else if (scope === 'entrenos') {
    timestamp = g.entrenos_at;
  } else {
    // 'any' → el más reciente de los dos
    const max = Math.max(g.menu_at ?? 0, g.entrenos_at ?? 0);
    timestamp = max > 0 ? max : null;
  }

  if (timestamp === null) return null;
  const ts = timestamp;

  return (
    <>
      <button
        type="button"
        className="ai-generated-badge"
        aria-label={`${SCOPE_LABEL[scope]} generado con IA · pulsa para ver cuándo`}
        onClick={(e) => {
          e.currentTarget.blur();
          setInfoOpen(true);
        }}
      >
        <MealIcon value="tb:sparkles" size={14} />
        <span className="ai-generated-badge-label">
          {SCOPE_LABEL[scope]} · {formatDate(ts)}
        </span>
      </button>

      <IonAlert
        isOpen={infoOpen}
        onDidDismiss={() => setInfoOpen(false)}
        header="Generado con IA"
        message={`Tu ${SCOPE_NOUN[scope]} se generó con IA el ${formatDateTime(ts)}.`}
        buttons={['Entendido']}
      />
    </>
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

// Fecha + hora completas para el alert · "29 de mayo de 2026, 14:32".
function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
