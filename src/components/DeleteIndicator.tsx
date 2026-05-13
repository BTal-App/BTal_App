import { SaveIndicator, type SaveStatus } from './SaveIndicator';

// Chip semántico para flujos de DELETE · reutiliza la misma UI que
// SaveIndicator (spinner → check → cross con colores coherentes) pero
// con labels propias del verbo "eliminar":
//
//   idle      → oculto
//   saving    → "Eliminando…"
//   saved     → "Eliminado correctamente"
//   error     → "Error al eliminar"
//
// Los estados se llaman igual (saving/saved/error) porque vienen del
// mismo `useSaveStatus()` · solo cambian las etiquetas visibles. El
// color del check sigue siendo "success" (lima/verde) · el delete
// terminó OK, no es error.

interface Props {
  status: SaveStatus;
  // Overrides opcionales si quieres adaptar el mensaje al contexto
  // (ej. "Vaciando comida…" en lugar del genérico).
  deletingLabel?: string;
  deletedLabel?: string;
  errorLabel?: string;
}

export function DeleteIndicator({
  status,
  deletingLabel = 'Eliminando…',
  deletedLabel = 'Eliminado correctamente',
  errorLabel = 'Error al eliminar',
}: Props) {
  return (
    <SaveIndicator
      status={status}
      savingLabel={deletingLabel}
      savedLabel={deletedLabel}
      errorLabel={errorLabel}
    />
  );
}
