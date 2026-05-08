import { IonIcon, IonSpinner } from '@ionic/react';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import './SaveIndicator.css';

// Estados del ciclo de guardado:
//   idle    → sin actividad reciente · indicador oculto
//   saving  → escritura a Firestore en curso · spinner + "Guardando…"
//   saved   → escritura confirmada · check + "Guardado" durante ~1.5s
//   error   → falló · icono coral + "Error" durante ~3s
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  status: SaveStatus;
  // Texto opcional para sobreescribir el por defecto. Útil en contextos
  // específicos ("Generando con IA…", "Sincronizando…").
  savingLabel?: string;
  savedLabel?: string;
  errorLabel?: string;
}

// Chip pequeño que muestra el estado del guardado a Firestore. Aparece
// junto al botón Guardar y desaparece automáticamente tras éxito/error
// (lo gestiona el hook useSaveStatus). Sincronizado con la duración real
// de la escritura — sin temporizadores artificiales en saving.
export function SaveIndicator({
  status,
  savingLabel = 'Guardando…',
  savedLabel = 'Guardado',
  errorLabel = 'Error al guardar',
}: Props) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="save-indicator save-indicator--saving" aria-live="polite">
        <IonSpinner name="dots" />
        <span>{savingLabel}</span>
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="save-indicator save-indicator--saved" aria-live="polite">
        <IonIcon icon={checkmarkCircleOutline} />
        <span>{savedLabel}</span>
      </span>
    );
  }
  return (
    <span className="save-indicator save-indicator--error" aria-live="assertive">
      <IonIcon icon={alertCircleOutline} />
      <span>{errorLabel}</span>
    </span>
  );
}
