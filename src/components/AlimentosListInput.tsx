import { useState, type KeyboardEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { addOutline, closeOutline } from 'ionicons/icons';
import type { Alimento } from '../templates/defaultUser';
import './AlimentosListInput.css';

interface Props {
  value: Alimento[];
  onChange: (next: Alimento[]) => void;
  // Texto del aria-label común a los inputs (a11y).
  ariaLabelPrefix?: string;
}

// Editor de lista de alimentos con dos campos por fila: nombre y cantidad.
// Usado en MealEditorModal (Sub-fase 2B.4). Pattern:
//   - Cada Alimento se renderiza como una fila editable con dos inputs.
//   - El botón X de la fila la elimina inmediatamente.
//   - Al final hay un mini-form para añadir un nuevo alimento (nombre +
//     cantidad). Pulsar Enter en cualquiera de los dos campos lo añade
//     y limpia el draft. Botón "+" hace lo mismo.
//   - Si el draft está en blanco no añade nada.
//   - Permite reorder mental (futuro: drag&drop, ahora plano).
export function AlimentosListInput({
  value,
  onChange,
  ariaLabelPrefix = 'Alimento',
}: Props) {
  const [draftNombre, setDraftNombre] = useState('');
  const [draftCantidad, setDraftCantidad] = useState('');

  // Mutación de un alimento existente (cambia nombre o cantidad).
  const updateAt = (idx: number, key: keyof Alimento, val: string) => {
    onChange(
      value.map((a, i) => (i === idx ? { ...a, [key]: val } : a)),
    );
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const tryAdd = () => {
    const nombre = draftNombre.trim().replace(/\s+/g, ' ');
    const cantidad = draftCantidad.trim().replace(/\s+/g, ' ');
    if (!nombre) return; // nombre obligatorio
    onChange([...value, { nombre, cantidad }]);
    setDraftNombre('');
    setDraftCantidad('');
  };

  const handleDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryAdd();
    }
  };

  return (
    <div className="alimentos-list">
      {/* Filas existentes · cada una editable inline */}
      {value.length > 0 && (
        <div className="alimentos-list-rows">
          {value.map((al, i) => (
            <div key={i} className="alimentos-row">
              <input
                type="text"
                className="alimentos-input alimentos-input--nombre"
                value={al.nombre}
                placeholder="Alimento"
                aria-label={`${ariaLabelPrefix} ${i + 1} · nombre`}
                maxLength={60}
                onChange={(e) => updateAt(i, 'nombre', e.target.value)}
              />
              <input
                type="text"
                className="alimentos-input alimentos-input--cantidad"
                value={al.cantidad}
                placeholder="Cantidad"
                aria-label={`${ariaLabelPrefix} ${i + 1} · cantidad`}
                maxLength={20}
                onChange={(e) => updateAt(i, 'cantidad', e.target.value)}
              />
              <button
                type="button"
                className="alimentos-row-remove"
                onClick={() => removeAt(i)}
                aria-label={`Quitar ${al.nombre || 'alimento ' + (i + 1)}`}
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fila de añadido · siempre visible al final · Enter o botón + añade */}
      <div className="alimentos-row alimentos-row--draft">
        <input
          type="text"
          className="alimentos-input alimentos-input--nombre"
          value={draftNombre}
          placeholder="Añadir alimento (ej. Avena)"
          aria-label={`Nuevo ${ariaLabelPrefix.toLowerCase()} · nombre`}
          maxLength={60}
          onChange={(e) => setDraftNombre(e.target.value)}
          onKeyDown={handleDraftKey}
        />
        <input
          type="text"
          className="alimentos-input alimentos-input--cantidad"
          value={draftCantidad}
          placeholder="Cantidad (ej. 60 g)"
          aria-label={`Nuevo ${ariaLabelPrefix.toLowerCase()} · cantidad`}
          maxLength={20}
          onChange={(e) => setDraftCantidad(e.target.value)}
          onKeyDown={handleDraftKey}
        />
        <button
          type="button"
          className="alimentos-row-add"
          onClick={tryAdd}
          disabled={!draftNombre.trim()}
          aria-label="Añadir alimento"
        >
          <IonIcon icon={addOutline} />
        </button>
      </div>
    </div>
  );
}
