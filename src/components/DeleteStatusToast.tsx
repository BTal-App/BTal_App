import { SaveStatusToast } from './SaveStatusToast';
import type { SaveStatus } from './SaveIndicator';

// Toast semántico para flujos de DELETE inline en páginas · reutiliza
// la UI de SaveStatusToast (IonToast secuencial en position="top" con
// colores medium/success/danger) pero con etiquetas propias del verbo
// "eliminar":
//
//   saving → "Eliminando…"        (color medium · no auto-cierra)
//   saved  → "Eliminado correctamente" (color success · 1500ms)
//   error  → "Error al eliminar"  (color danger · 3000ms)
//
// Mismo hook subyacente `useSaveStatus()` · solo cambian las labels.

interface Props {
  status: SaveStatus;
  // Overrides opcionales para contextos específicos.
  deletingLabel?: string;
  deletedLabel?: string;
  errorLabel?: string;
}

export function DeleteStatusToast({
  status,
  deletingLabel = 'Eliminando…',
  deletedLabel = 'Eliminado correctamente',
  errorLabel = 'Error al eliminar',
}: Props) {
  return (
    <SaveStatusToast
      status={status}
      savingLabel={deletingLabel}
      savedLabel={deletedLabel}
      errorLabel={errorLabel}
    />
  );
}
