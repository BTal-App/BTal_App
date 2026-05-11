import {
  IonButton,
  IonContent,
  IonModal,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { type ChangeEntry } from '../utils/confirmDiff';
import './ConfirmDiffAlert.css';

// Modal de confirmación con diff antes/después · réplica del v1
// confirmSave. Antes usábamos IonAlert + IonicSafeString con HTML
// inline, pero IonAlert tiene soporte HTML muy limitado y se rompe
// con `<span style="...">` (errores de tipo "Cannot read properties
// of undefined (reading 'length')" desde el render interno). Por eso
// ahora usamos un IonModal custom donde renderizamos el diff con
// JSX nativo · control total del estilo y sin ambigüedad.
//
// Uso típico:
//   const [pending, setPending] = useState<{ changes, cleaned } | null>(null);
//   ...
//   <ConfirmDiffAlert
//     pending={pending}
//     onCancel={() => setPending(null)}
//     onConfirm={() => persist(pending.cleaned).finally(() => setPending(null))}
//   />

export interface PendingConfirm<T> {
  changes: ChangeEntry[];
  cleaned: T;
}

interface Props<T> {
  pending: PendingConfirm<T> | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDiffAlert<T>({
  pending,
  onCancel,
  onConfirm,
}: Props<T>) {
  const isOpen = pending !== null;
  const noChanges = pending !== null && pending.changes.length === 0;

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      className="confirm-diff-modal"
    >
      <IonContent>
        <div className="confirm-diff-bg">
        <div className="confirm-diff-card">
          <div className="confirm-diff-head">
            <h2 className="confirm-diff-title">
              {noChanges ? 'Sin cambios' : '¿Confirmar cambios?'}
            </h2>
            <button
              type="button"
              className="confirm-diff-close"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onCancel();
              }}
              aria-label="Cerrar"
            >
              <MealIcon value="tb:x" size={22} />
            </button>
          </div>

          <div className="confirm-diff-body">
            {noChanges || !pending ? (
              <p className="confirm-diff-empty">
                Sin cambios detectados.
              </p>
            ) : (
              <div className="confirm-diff-list">
                {pending.changes.map((c, i) => (
                  <div key={i} className="confirm-diff-entry">
                    <div className="confirm-diff-label">{c.label}</div>
                    <div className="confirm-diff-row">
                      <span className="confirm-diff-arrow">·</span>
                      <span className="confirm-diff-side-label">Antes:</span>
                      <span className="confirm-diff-from">{c.from}</span>
                    </div>
                    <div className="confirm-diff-row">
                      <span className="confirm-diff-arrow">·</span>
                      <span className="confirm-diff-side-label">Después:</span>
                      <span className="confirm-diff-to">{c.to}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="confirm-diff-actions">
            {noChanges ? (
              <IonButton
                expand="block"
                className="confirm-diff-btn-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  onCancel();
                }}
              >
                Cerrar
              </IonButton>
            ) : (
              <>
                <IonButton
                  fill="outline"
                  className="confirm-diff-btn-cancel"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    onCancel();
                  }}
                >
                  Cancelar
                </IonButton>
                <IonButton
                  className="confirm-diff-btn-primary"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    onConfirm();
                  }}
                >
                  Guardar
                </IonButton>
              </>
            )}
          </div>
        </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
