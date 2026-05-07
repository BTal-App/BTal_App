import { useState, type KeyboardEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { addOutline, closeOutline } from 'ionicons/icons';
import './ChipsInput.css';

interface Props {
  // Lista de chips activos.
  value: string[];
  // Callback cuando se añade o elimina un chip.
  onChange: (next: string[]) => void;
  // Placeholder del input.
  placeholder?: string;
  // Color de tema · 'lime' (favoritos), 'cyan' (obligatorios), 'coral' (prohibidos).
  // Default 'cyan'.
  color?: 'lime' | 'cyan' | 'coral' | 'violet';
  // Texto del aria-label (para a11y · ej: "Añadir alimento prohibido").
  ariaLabel?: string;
  // Máximo de caracteres por chip. Default 60 — suficiente para un alimento
  // o frase corta, evita pegar páginas enteras de texto.
  maxLength?: number;
}

// Input para gestionar listas de strings como chips. El usuario escribe,
// pulsa Enter o coma para añadir, X para borrar. Reusable para alergias,
// intolerancias, alimentos prohibidos / obligatorios / favoritos.
//
// Diseño: input arriba con botón "+", chips abajo con X para borrar.
// Vacío = solo el input visible (sin sección de chips).
export function ChipsInput({
  value,
  onChange,
  placeholder,
  color = 'cyan',
  ariaLabel,
  maxLength = 60,
}: Props) {
  const [draft, setDraft] = useState('');

  const tryAdd = (raw: string) => {
    // Sanitizamos: trim + colapsa cualquier secuencia de whitespace
    // (incluidos saltos de línea de un paste multilinea) en un único
    // espacio. Sin esto, copiar algo tipo "Melocotón\nRojo" desde
    // otro sitio dejaría chips con saltos de línea visibles.
    const cleaned = raw.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;
    // Evitar duplicados (case-insensitive).
    const lower = cleaned.toLowerCase();
    if (value.some((v) => v.toLowerCase() === lower)) {
      setDraft('');
      return;
    }
    onChange([...value, cleaned]);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter o coma confirma · Backspace en draft vacío borra el último chip.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      tryAdd(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className={'chips-input chips-input--' + color}>
      <div className="chips-input-row">
        <input
          type="text"
          className="chips-input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKey}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          maxLength={maxLength}
        />
        <button
          type="button"
          className="chips-input-add"
          onClick={() => tryAdd(draft)}
          disabled={!draft.trim()}
          aria-label="Añadir"
        >
          <IonIcon icon={addOutline} />
        </button>
      </div>
      {value.length > 0 && (
        <div className="chips-input-list">
          {value.map((chip, i) => (
            <span key={`${chip}-${i}`} className="chips-input-chip">
              {chip}
              <button
                type="button"
                className="chips-input-remove"
                onClick={() => remove(i)}
                aria-label={`Quitar ${chip}`}
              >
                <IonIcon icon={closeOutline} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
