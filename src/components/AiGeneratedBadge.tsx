import { MealIcon } from './MealIcon';
import type { UserDocument } from '../templates/defaultUser';
import './AiGeneratedBadge.css';

// Qué timestamp mostrar:
//   - 'menu'     → solo el último del menú (se usa en MenuPage)
//   - 'entrenos' → solo el último del plan de entreno (EntrenoPage)
//   - 'any'      → el más reciente de los dos (HoyPage)
type BadgeScope = 'menu' | 'entrenos' | 'any';

interface Props {
  userDoc: UserDocument | null;
  scope: BadgeScope;
}

const SCOPE_LABEL: Record<BadgeScope, string> = {
  menu: 'Menú',
  entrenos: 'Entreno',
  any: 'Plan',
};

// Chip compacto que se muestra junto al botón "Generar con IA" cuando ya
// hay una generación previa para ese scope. Texto:
//   "Generado por IA · [scope] · [fecha]"
//
// Si nunca se ha generado nada (timestamp null), devuelve null y no se
// renderiza · así el botón Generar se queda solo y limpio.
export function AiGeneratedBadge({ userDoc, scope }: Props) {
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

  return (
    <span className="ai-generated-badge" aria-label="Plan generado por IA">
      <MealIcon value="tb:sparkles" size={14} />
      <span className="ai-generated-badge-label">
        {SCOPE_LABEL[scope]} · {formatDate(timestamp)}
      </span>
    </span>
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}
