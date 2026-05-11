import { useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import {
  emptyDiaEntreno,
  newPlanEntrenoId,
  type DayKey,
  type DiaEntreno,
  type PlanEntreno,
} from '../templates/defaultUser';
import { DAY_OPTIONS } from '../utils/diaSemana';
import { diffPlan, type ChangeEntry } from '../utils/entrenoDiff';
import { blurAndRun } from '../utils/focus';
import {
  SAVE_FAILED,
  SAVED_INDICATOR_MS,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { SaveIndicator } from './SaveIndicator';
import './SettingsModal.css';
import './SupModal.css';
import './PlanEditorModal.css';

// Editor de un plan completo (modo nuevo o edición). Replica del v1
// `openPlanModal` simplificado: gestiona la metadata del plan (nombre)
// + el listado de días (añadir/quitar/renombrar rápido). Para editar
// el contenido detallado de cada día, el user cierra el modal y abre
// el DiaEditorModal desde la EntrenoPage.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Si se pasa plan, modo edit. Si no, modo create.
  plan?: PlanEntreno;
  // IDs ya existentes · el editor evita colisiones de id al crear
  // un plan custom nuevo (genera con newPlanEntrenoId hasta encontrar
  // uno libre).
  existingPlanIds: string[];
  onSave: (plan: PlanEntreno) => Promise<void> | void;
}

const NOMBRE_MAX = 40;
const DAY_TITLE_MAX = 50;

export function PlanEditorModal({
  isOpen,
  onClose,
  plan,
  existingPlanIds,
  onSave,
}: Props) {
  const isEdit = !!plan;
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [dias, setDias] = useState<DiaEntreno[]>(plan?.dias ?? []);
  // Toggle "Marcar como predeterminado" · solo aplica a planes custom
  // (no a builtIn). Si está activo, el chip de EntrenoPage se renderiza
  // sin tag con el nombre · idéntico a los builtIn 1-7 días. Sub-fase 2D.1.
  const [esPredeterminado, setEsPredeterminado] = useState<boolean>(
    plan?.esPredeterminado ?? false,
  );
  // Status del guardado · saving/saved/error · alimenta el SaveIndicator.
  const { status, runSave, reset: resetSave } = useSaveStatus();
  const submitting = status === 'saving';
  // Toast tras éxito + cierre con delay para que el chip "Guardado"
  // sea visible (réplica del patrón MealEditor / BatidoInfo).
  const [savedToast, setSavedToast] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // IonAlert "Faltan campos obligatorios" · réplica del v1
  // (savePlanModal `mobileConfirm`). Lista los campos que fallan al
  // intentar guardar para que el user los rellene.
  const [missingAlert, setMissingAlert] = useState<string[] | null>(null);
  // IonAlert "¿Confirmar cambios?" con la lista de diff antes/después.
  // Réplica del v1 (`confirmSave(planChanges)`). Guardamos también el
  // plan ya validado para persistirlo si el user confirma.
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: PlanEntreno;
  } | null>(null);
  // Confirmación borrar día · réplica v1 peDelDay con mobileConfirm.
  // Guardamos el índice del día pendiente de borrar.
  const [confirmDeleteDia, setConfirmDeleteDia] = useState<number | null>(null);

  // Reset al re-abrir · evita arrastrar edits sin guardar.
  const handleWillPresent = () => {
    setNombre(plan?.nombre ?? '');
    setDias(
      plan?.dias ?? [
        // Modo new · arrancamos con 1 día vacío para no enseñar plan a 0 días.
        { ...emptyDiaEntreno(), titulo: 'Día 1' },
      ],
    );
    setEsPredeterminado(plan?.esPredeterminado ?? false);
    resetSave();
    setMissingAlert(null);
    setConfirmChanges(null);
    setSavedToast(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const updateDia = (idx: number, partial: Partial<DiaEntreno>) => {
    setDias((cur) => {
      const next = [...cur];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  };

  const addDia = () => {
    setDias((cur) => [
      ...cur,
      { ...emptyDiaEntreno(), titulo: `Día ${cur.length + 1}` },
    ]);
  };

  const requestRemoveDia = (idx: number) => {
    setConfirmDeleteDia(idx);
  };

  const confirmRemoveDia = () => {
    if (confirmDeleteDia === null) return;
    const idx = confirmDeleteDia;
    setDias((cur) => cur.filter((_, i) => i !== idx));
    setConfirmDeleteDia(null);
  };

  const handleSave = async () => {
    if (submitting) return;
    const trimmedNombre = nombre.trim();

    // ── Validación v1 (savePlanModal) ──
    // Réplica exacta de los campos obligatorios del v1: nombre del
    // plan, al menos un día, y cada día con título no vacío. Cualquier
    // otro campo (descripción, badges, ejercicios, comentario, día
    // semana) es opcional. La estructura/sub-estructura ya no se editan
    // desde la UI (se preservan del plan original si existían).
    const missing: string[] = [];
    if (!trimmedNombre) missing.push('Nombre del plan');
    if (dias.length === 0) {
      missing.push('Al menos un día de entrenamiento');
    } else {
      dias.forEach((d, i) => {
        if (!d.titulo.trim()) {
          missing.push(`Título del día ${i + 1}`);
        }
      });
    }
    if (missing.length > 0) {
      setMissingAlert(missing);
      return;
    }

    // Genera un id custom único · no choca con existentes ni con builtIn
    // ('1dias'..'7dias'). Si es edit, mantiene el id existente para no
    // perder el activePlan ni romper referencias.
    let planId: string;
    if (isEdit && plan) {
      planId = plan.id;
    } else {
      do {
        planId = newPlanEntrenoId();
      } while (existingPlanIds.includes(planId));
    }

    const cleaned: PlanEntreno = {
      id: planId,
      nombre: trimmedNombre,
      // Preservamos la estructura/sub-estructura del plan original (si
      // existían en planes builtIn o en planes legacy generados antes
      // de quitar el campo de la UI) · al crear nuevo arrancan vacías.
      estructura: plan?.estructura ?? '',
      estructura2: plan?.estructura2 ?? '',
      dias: dias.map((d) => ({
        ...d,
        titulo: d.titulo.trim() || 'Día',
      })),
      // builtIn solo si veníamos editando uno · al crear nuevo siempre
      // es custom (false). v1 distingue 1dias..7dias como builtIn.
      builtIn: isEdit && plan ? plan.builtIn : false,
      // Sub-fase 2D.1 · solo persistimos esPredeterminado en planes
      // custom · los builtIn ya son predeterminados implícitamente y
      // no necesitan la flag (sería redundante). Si el plan es builtIn,
      // dejamos esPredeterminado fuera del doc (undefined).
      ...(isEdit && plan?.builtIn
        ? {}
        : { esPredeterminado }),
    };

    // Construye el diff antes/después · réplica del v1 confirmSave.
    // En modo nuevo el oldPlan es undefined → todos los campos como
    // "— → valor". En edit, solo los que cambian.
    const changes = diffPlan(plan, cleaned);
    setConfirmChanges({ changes, cleaned });
  };

  // Confirma y persiste · envuelto en `runSave` para que el
  // SaveIndicator muestre "Guardando…" → "Guardado" durante el ciclo.
  // Tras éxito, toast + cierre con delay (1.5s) para que el chip
  // "Guardado" sea visible. En error queda visible "Error" 3s.
  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() => Promise.resolve(onSave(cleaned)));
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  // Botón Guardar nunca disabled por validación inline · al pulsarlo
  // mostramos el IonAlert con los campos faltantes (UX v1: el user
  // puede pulsar siempre y recibir feedback explícito de qué falta).
  const canSave = !submitting;

  return (
    <IonModal
      isOpen={isOpen}
      onWillPresent={handleWillPresent}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      <IonContent>
        <div className="settings-modal-bg">
          <div className="settings-modal-card">
            {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
            <button
              type="button"
              className="settings-modal-close settings-modal-close--fixed"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onClose();
              }}
              aria-label="Cerrar"
            >
              <MealIcon value="tb:x" size={22} />
            </button>
            <h2 className="settings-modal-title">
              {isEdit ? 'Editar plan' : 'Nuevo plan'}
            </h2>
            <p className="settings-modal-text">
              {isEdit
                ? 'Edita el nombre y los días del plan. Para cambiar los ejercicios de un día, ciérralo y púlsalo en la lista.'
                : 'Crea un plan personalizado con tus propios días y ejercicios. Después podrás editarlos uno por uno.'}
            </p>

            <div className="sup-form-group">
              <label className="sup-label">
                Nombre del plan
                <span className="plan-editor-required">*</span>
              </label>
              <input
                className="sup-input"
                type="text"
                maxLength={NOMBRE_MAX}
                placeholder='ej. "Plan 5 Días — Push/Pull/Legs"'
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus={!isEdit}
              />
            </div>

            {/* Toggle "predeterminado" · solo en planes custom (los
                builtIn 1-7 días ya son predeterminados implícitamente).
                Cuando está activo, el chip de EntrenoPage se renderiza
                centrado sin la tag con el nombre debajo · idéntico look
                a los builtIn. Útil para que el user destaque su plan
                habitual entre el resto de custom. */}
            {!plan?.builtIn && (
              <div className="sup-form-group">
                <label className="plan-editor-toggle">
                  <input
                    type="checkbox"
                    checked={esPredeterminado}
                    onChange={(e) => setEsPredeterminado(e.target.checked)}
                  />
                  <span className="plan-editor-toggle-label">
                    Marcar como predeterminado
                  </span>
                  <span className="plan-editor-toggle-hint">
                    Se mostrará centrado y sin etiqueta, igual que los
                    planes 1–7 días.
                  </span>
                </label>
              </div>
            )}

            {/* Lista de días · sólo título + día semana + borrar · el
                resto (badges, ejercicios, comentario) se edita después
                desde el DiaEditorModal abriéndolo desde EntrenoPage.
                Réplica del v1 · cada día requiere un título no vacío
                para guardar el plan. */}
            <div className="plan-editor-section-head">
              <h3>
                Días del plan
                <span className="plan-editor-required">*</span>
              </h3>
              <span className="plan-editor-count">
                {dias.length}{' '}
                {dias.length === 1 ? 'día seleccionado' : 'días seleccionados'}
              </span>
            </div>

            {dias.map((d, i) => (
              <div key={i} className="plan-editor-day-row">
                <div className="plan-editor-day-num">{i + 1}</div>
                <div className="plan-editor-day-fields">
                  <input
                    className={
                      'sup-input plan-editor-day-input'
                      + (!d.titulo.trim() ? ' plan-editor-day-input--missing' : '')
                    }
                    type="text"
                    maxLength={DAY_TITLE_MAX}
                    placeholder={`Día ${i + 1} · título obligatorio`}
                    value={d.titulo}
                    onChange={(e) => updateDia(i, { titulo: e.target.value })}
                    aria-required="true"
                  />
                  <select
                    className="sup-input plan-editor-day-select"
                    value={d.diaSemana ?? ''}
                    onChange={(e) =>
                      updateDia(i, {
                        diaSemana: (e.target.value || null) as DayKey | null,
                      })
                    }
                  >
                    <option value="">— Sin asignar —</option>
                    {/* Optgroup "DÍA" en amarillo · coherente con
                        DiaEditorModal y los selectores de tipo.
                        Labels en uppercase. */}
                    <optgroup label="Día">
                      {DAY_OPTIONS.map((day) => (
                        <option key={day.val} value={day.val}>
                          {day.label.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <button
                  type="button"
                  className="plan-editor-day-del"
                  onClick={blurAndRun(() => requestRemoveDia(i))}
                  aria-label={`Quitar día ${i + 1}`}
                  // Permitimos quedar a 1 día mínimo · si es el último, deshabilitamos.
                  disabled={dias.length <= 1}
                >
                  <MealIcon value="tb:trash" size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="plan-editor-add-btn"
              onClick={blurAndRun(addDia)}
            >
              <MealIcon value="tb:plus" size={18} />
              Añadir día
            </button>

            {/* Indicador de estado del guardado · "Guardando…" /
                "Guardado" / "Error". Réplica del patrón MealEditor. */}
            <div className="save-indicator-wrap">
              <SaveIndicator status={status} />
            </div>

            <div className="sup-actions">
              <IonButton
                type="button"
                fill="outline"
                className="sup-action-cancel"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  onClose();
                }}
                disabled={submitting}
              >
                Cancelar
              </IonButton>
              <IonButton
                type="button"
                className="settings-modal-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleSave();
                }}
                disabled={!canSave}
              >
                {isEdit ? 'Guardar' : 'Crear plan'}
              </IonButton>
            </div>
          </div>
        </div>
      </IonContent>

      {/* Alert "Faltan campos obligatorios" · réplica exacta del v1
          (savePlanModal). Lista los campos que faltan rellenar. */}
      <IonAlert
        isOpen={missingAlert !== null}
        onDidDismiss={() => setMissingAlert(null)}
        header="Faltan campos obligatorios"
        message={
          missingAlert
            ? `Para guardar el plan necesitas rellenar:\n\n${missingAlert
                .map((m) => `• ${m}`)
                .join('\n')}`
            : ''
        }
        buttons={[{ text: 'Entendido', role: 'cancel' }]}
      />

      {/* Confirmación borrar día · réplica v1 peDelDay */}
      <IonAlert
        isOpen={confirmDeleteDia !== null}
        onDidDismiss={() => setConfirmDeleteDia(null)}
        header="¿Eliminar día?"
        message={
          confirmDeleteDia !== null
            ? `Se eliminará "${
                dias[confirmDeleteDia]?.titulo.trim()
                || `Día ${confirmDeleteDia + 1}`
              }" y todos sus ejercicios.`
            : ''
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              confirmRemoveDia();
            },
          },
        ]}
      />

      {/* Alert "¿Confirmar cambios?" · diff antes/después · réplica
          v1 confirmSave. */}
      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message={isEdit ? 'Plan guardado' : 'Plan creado'}
        duration={1800}
        position="bottom"
        color="success"
      />
    </IonModal>
  );
}
