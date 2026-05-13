import { IonToast } from '@ionic/react';
import type { SaveStatus } from './SaveIndicator';

// Toast secuencial que muestra el ciclo "Guardando… → Guardado / Error"
// en páginas (no modales). Equivalente visual al `<SaveIndicator />`
// que vive dentro de modales · misma semántica de estados.
//
// Pensado para acciones inline en las páginas (eliminar plan de entreno,
// vaciar comida, eliminar registro de día, etc.) donde no hay un modal
// abierto donde mostrar el chip. El toast aparece arriba en `position="top"`
// para no chocar con el toolbar de tabs ni con el undo toast (que va en
// position="bottom").
//
// Uso típico:
//
//   const saveStatus = useSaveStatus();
//   const handleDelete = async () => {
//     const result = await saveStatus.runSave(() => removeFoo(id));
//     if (result === SAVE_FAILED) return;
//     // feedback de "Guardado" ya está visible · seguimos con undo etc
//   };
//
//   <SaveStatusToast status={saveStatus.status} />
//
// duración del estado 'saving' es 0 (no auto-cierra · vive lo que tarda
// la promesa). 'saved' y 'error' se auto-cierran tras 1500ms / 3000ms
// (los mismos que usa el hook para volver el status a 'idle').

interface Props {
  status: SaveStatus;
  // Personalización opcional de los textos.
  savingLabel?: string;
  savedLabel?: string;
  errorLabel?: string;
}

export function SaveStatusToast({
  status,
  savingLabel = 'Guardando…',
  savedLabel = 'Guardado',
  errorLabel = 'Error al guardar',
}: Props) {
  if (status === 'idle') return null;
  const isSaving = status === 'saving';
  const isSaved = status === 'saved';
  const message = isSaving ? savingLabel : isSaved ? savedLabel : errorLabel;
  const color = isSaving ? 'medium' : isSaved ? 'success' : 'danger';
  // 0 = no auto-cierra (saving) · 1500 (saved) coincide con el TTL del hook
  // tras éxito · 3000 (error) coincide con el TTL del hook tras fallo.
  const duration = isSaving ? 0 : isSaved ? 1500 : 3000;

  return (
    <IonToast
      isOpen
      message={message}
      color={color}
      position="top"
      duration={duration}
      // Sin onDidDismiss · el control de cuándo desaparece lo lleva el
      // status del useSaveStatus que ya lo apaga tras los timeouts.
    />
  );
}
