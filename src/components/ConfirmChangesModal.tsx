import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
} from '@ionic/react';
import {
  arrowForwardOutline,
  checkmarkCircle,
  closeOutline,
} from 'ionicons/icons';
import { SaveIndicator, type SaveStatus } from './SaveIndicator';
import './SettingsModal.css';
import './ConfirmChangesModal.css';

// Un campo modificado entre dos versiones del mismo objeto. La UI
// renderiza una fila con la etiqueta del campo + valor antes (tachado
// gris) → valor después (lima destacado).
export interface Change {
  // Etiqueta humana del campo · "Hora", "Calorías", "Alimentos", etc.
  label: string;
  // Representación textual del valor anterior · "—" si no había nada.
  before: string;
  // Representación textual del valor nuevo · "—" si se vació.
  after: string;
}

interface Props {
  isOpen: boolean;
  // Cancela y cierra · usado por X y por el botón Cancelar. NO confirma.
  onCancel: () => void;
  // Confirma los cambios · el caller hace la persistencia real.
  onConfirm: () => void;
  // Lista de cambios a mostrar. Si está vacía la modal no debería abrirse,
  // pero por seguridad mostramos un mensaje "sin cambios".
  changes: Change[];
  // Texto del header · varía según contexto ("¿Guardar la comida?", etc.).
  title?: string;
  description?: string;
  // Estado del guardado, sincronizado con la duración real de la escritura
  // a Firestore. Lo gestiona el caller con `useSaveStatus`. La modal:
  //   - 'saving' → SaveIndicator visible · botón Confirmar bloqueado
  //   - 'saved'  → SaveIndicator "Guardado" · el caller cierra tras 1.5s
  //   - 'error'  → SaveIndicator "Error" · botones desbloqueados para reintentar
  status?: SaveStatus;
  // Si la última escritura falló, el caller pasa este mensaje y la modal
  // lo muestra arriba (en color coral). El SaveIndicator también muestra
  // "Error", pero este mensaje aporta detalle (ej. "Sin conexión").
  errorMsg?: string;
}

// Modal de confirmación con diff de campos modificados antes/después.
// Reusable desde MealEditorModal y, en el futuro, desde el editor de
// ejercicios (Fase 2D), el de items de compra (Fase 2C), y EditFitnessProfile.
//
// Comportamiento:
//   - X arriba a la derecha = cancelar (no descarta los cambios del editor
//     padre, solo cierra esta confirmación · el padre vuelve al estado
//     "editando" para que el user pueda seguir cambiando o pulsar Guardar
//     de nuevo).
//   - Botón "Cancelar" = igual que X.
//   - Botón "Confirmar" = dispara onConfirm. El padre persiste + cierra
//     todo el flujo (editor + confirmación).
export function ConfirmChangesModal({
  isOpen,
  onCancel,
  onConfirm,
  changes,
  title = '¿Confirmar los cambios?',
  description = 'Revisa lo que has modificado. Si está bien, pulsa Confirmar; si quieres cambiar algo más, pulsa Cancelar para volver al editor.',
  status = 'idle',
  errorMsg,
}: Props) {
  const submitting = status === 'saving';
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      className="settings-modal"
    >
      <button
        type="button"
        className="settings-modal-close settings-modal-close--fixed"
        onClick={(e) => {
          e.currentTarget.blur();
          if (!submitting) onCancel();
        }}
        aria-label="Cerrar"
      >
        <IonIcon icon={closeOutline} />
      </button>
      <IonContent>
        <div className="settings-modal-bg">
          <div className="settings-modal-card confirm-changes-card">
            <h2 className="settings-modal-title">{title}</h2>
            <p className="settings-modal-text">{description}</p>

            {errorMsg && <div className="landing-msg error">{errorMsg}</div>}

            {/* Lista de cambios · cada uno con label + before → after */}
            {changes.length === 0 ? (
              <p className="confirm-changes-empty">No hay cambios que guardar.</p>
            ) : (
              <ul className="confirm-changes-list">
                {changes.map((c) => (
                  <li key={c.label} className="confirm-changes-row">
                    <span className="confirm-changes-label">{c.label}</span>
                    <div className="confirm-changes-diff">
                      <span className="confirm-changes-before">{c.before || '—'}</span>
                      <IonIcon icon={arrowForwardOutline} className="confirm-changes-arrow" />
                      <span className="confirm-changes-after">{c.after || '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Indicador de estado del guardado · sincronizado con la
                duración real de la escritura a Firestore (sin simulación). */}
            <div className="save-indicator-wrap">
              <SaveIndicator status={status} />
            </div>

            <div className="confirm-changes-actions">
              <IonButton
                type="button"
                fill="outline"
                className="confirm-changes-cancel"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCancel();
                }}
                disabled={submitting}
              >
                Cancelar
              </IonButton>
              <IonButton
                type="button"
                className="settings-modal-primary confirm-changes-confirm"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onConfirm();
                }}
                disabled={submitting || changes.length === 0}
              >
                <IonIcon icon={checkmarkCircle} slot="start" />
                Confirmar
              </IonButton>
            </div>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
