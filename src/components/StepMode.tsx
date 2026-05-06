import { IonIcon } from '@ionic/react';
import { createOutline, sparklesOutline } from 'ionicons/icons';
import {
  AI_SCOPE_OPTIONS,
  type AiScopeChoice,
  type Modo,
  type StepModeValue,
} from '../templates/defaultUser';
import './StepMode.css';

// Re-export para no romper imports existentes que esperan el tipo desde
// este archivo. La fuente de verdad ahora vive en templates/defaultUser.ts.
export type { StepModeValue } from '../templates/defaultUser';

interface Props {
  value: StepModeValue;
  onChange: (val: StepModeValue) => void;
  variant?: 'onboarding' | 'compact';
}

// Componente reusable para elegir entre IA y manual + (si IA) qué
// secciones generar. Se usa en:
//   - Onboarding (paso 4) — variant="onboarding"
//   - Settings → Cambiar modo de generación — variant="compact"
//
// La validación externa de "está completo" es:
//   value.modo === 'manual' || (value.modo === 'ai' && value.aiScope !== null)
export function StepMode({ value, onChange, variant = 'onboarding' }: Props) {
  const handleModoClick = (modo: Modo) => {
    if (modo === 'manual') {
      // Pasar a manual resetea el aiScope (no aplica).
      onChange({ modo, aiScope: null });
    } else {
      // Pasar a IA mantiene el aiScope previo si lo había, así si el
      // user oscila entre cards de modo no pierde la elección de scope.
      onChange({ modo, aiScope: value.aiScope });
    }
  };

  const handleScopeClick = (aiScope: AiScopeChoice) => {
    onChange({ modo: 'ai', aiScope });
  };

  return (
    <div className={'step-mode step-mode--' + variant}>
      <button
        type="button"
        className={'step-mode-card' + (value.modo === 'ai' ? ' active' : '')}
        onClick={() => handleModoClick('ai')}
        aria-pressed={value.modo === 'ai'}
      >
        <div className="step-mode-icon step-mode-icon--ai">
          <IonIcon icon={sparklesOutline} />
        </div>
        <div className="step-mode-info">
          <div className="step-mode-title">
            La IA genera mi plan
            <span className="step-mode-tag step-mode-tag--rec">Recomendado</span>
          </div>
          <div className="step-mode-sub">
            Generamos tu plan a partir de tus datos. Puedes editar cualquier
            cosa después y elegir qué secciones genera.
          </div>
          <div className="step-mode-meta">1 generación gratis al mes · ilimitado en Pro</div>
        </div>
      </button>

      <button
        type="button"
        className={'step-mode-card' + (value.modo === 'manual' ? ' active' : '')}
        onClick={() => handleModoClick('manual')}
        aria-pressed={value.modo === 'manual'}
      >
        <div className="step-mode-icon step-mode-icon--manual">
          <IonIcon icon={createOutline} />
        </div>
        <div className="step-mode-info">
          <div className="step-mode-title">Lo relleno yo mismo</div>
          <div className="step-mode-sub">
            Empiezas con la estructura vacía (7 días, 4 comidas, planes de
            entreno, lista por categorías) y la rellenas a tu ritmo. Podrás
            activar la IA en cualquier momento desde Ajustes.
          </div>
          <div className="step-mode-meta">Sin coste · sin límites de uso</div>
        </div>
      </button>

      {/* Sub-bloque · solo aparece si elige IA. Pregunta qué scope quiere. */}
      {value.modo === 'ai' && (
        <div className="step-mode-scope">
          <span className="step-mode-scope-label">
            ¿Qué quieres que la IA genere?
          </span>
          <div className="step-mode-scope-grid">
            {AI_SCOPE_OPTIONS.map((opt) => {
              const active = value.aiScope === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={'step-mode-scope-card' + (active ? ' active' : '')}
                  onClick={() => handleScopeClick(opt.value)}
                  aria-pressed={active}
                >
                  <span className="step-mode-scope-emoji">{opt.emoji}</span>
                  <span className="step-mode-scope-info">
                    <span className="step-mode-scope-title">{opt.label}</span>
                    <span className="step-mode-scope-sub">{opt.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
