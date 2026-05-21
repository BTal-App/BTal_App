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
  // Plan que ya tiene esPredeterminado=true (si lo hay). Necesario para
  // mostrar el IonAlert de confirmación cuando el user intenta marcar
  // OTRO plan como predeterminado. null si no hay ninguno actualmente.
  existingPredeterminado?: PlanEntreno | null;
  onSave: (plan: PlanEntreno) => Promise<void> | void;
}

const NOMBRE_MAX = 40;
const DAY_TITLE_MAX = 50;

export function PlanEditorModal({
  isOpen,
  onClose,
  plan,
  existingPlanIds,
  existingPredeterminado = null,
  onSave,
}: Props) {
  const isEdit = !!plan;
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [dias, setDias] = useState<DiaEntreno[]>(plan?.dias ?? []);
  // Toggle "Marcar como predeterminado" · aplica a builtIn y custom.
  // Si está activo, el chip de EntrenoPage muestra "★ Predeterminado"
  // y la lógica de recomendación lo respeta (ignora el cálculo basado
  // en `profile.diasEntreno`). Sub-fase 2D.1 · ampliado para incluir
  // builtIn: el user puede declarar "Plan 4 Días" como su predeterminado
  // y el ★ Recomendado se desactiva en favor de su decisión explícita.
  const [esPredeterminado, setEsPredeterminado] = useState<boolean>(
    plan?.esPredeterminado ?? false,
  );

  // Límite de días del plan. Los planes builtIn ('1dias'..'7dias') son
  // FIJOS en N días (Plan 1 Día = 1 día, Plan 7 Días = 7 días) · ni se
  // pueden añadir ni quitar días desde la UI · si esos cambian, dejan
  // de tener sentido (el nombre miente). Los custom permiten 1-7 días.
  const isBuiltInPlan = isEdit && plan?.builtIn === true;
  const planMaxDias = (() => {
    if (isBuiltInPlan && plan) {
      const m = /^(\d+)dias$/.exec(plan.id);
      if (m) return Math.max(1, Math.min(7, parseInt(m[1], 10)));
    }
    return 7;
  })();
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
  // IonAlert "¿Reemplazar el predeterminado?" · se dispara cuando el
  // user intenta marcar este plan como predeterminado pero ya existe
  // otro plan con la flag activa. Solo un plan a la vez puede serlo.
  const [confirmReplacePred, setConfirmReplacePred] = useState(false);
  // IonAlert "¿Quitar el predeterminado?" · se dispara cuando el user
  // desmarca el toggle en un plan que YA era predeterminado al abrir
  // el modal. Si lo marcó dentro de la sesión y lo desmarca sin guardar,
  // no se pregunta (es un toggle exploratorio).
  const [confirmRemovePred, setConfirmRemovePred] = useState(false);

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
    setConfirmReplacePred(false);
    setConfirmRemovePred(false);
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
    setDias((cur) => {
      if (cur.length >= planMaxDias) return cur;
      return [
        ...cur,
        { ...emptyDiaEntreno(), titulo: `Día ${cur.length + 1}` },
      ];
    });
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
      // Flag predeterminado · aplica a builtIn y custom por igual.
      // Cuando está activo, el chip de EntrenoPage se renderiza con
      // "★ Predeterminado" y la lógica de recomendación lo respeta
      // ignorando el cálculo basado en `profile.diasEntreno`.
      esPredeterminado,
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

            {/* Toggle "predeterminado" · aplica a builtIn y custom.
                Cuando está activo, el chip muestra "★ Predeterminado"
                y la lógica de recomendación lo respeta (ignora el
                cálculo automático basado en los días declarados).
                Si ya existe OTRO plan predeterminado y el user intenta
                activar este toggle, se dispara un IonAlert de
                confirmación · solo un plan puede ser pred a la vez. */}
            <div className="sup-form-group">
              <label className="plan-editor-toggle">
                <input
                  type="checkbox"
                  checked={esPredeterminado}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next) {
                      // Desactivando · solo confirmamos si el plan YA
                      // era predeterminado al abrir el modal. Si lo
                      // marcó dentro de la sesión y lo desmarca antes
                      // de guardar, es un toggle exploratorio y no
                      // tiene sentido pedir confirmación.
                      if (plan?.esPredeterminado) {
                        setConfirmRemovePred(true);
                      } else {
                        setEsPredeterminado(false);
                      }
                      return;
                    }
                    // Activando · si ya hay otro pred, pedir confirmación
                    // (a no ser que éste sea el plan que ya estaba pred).
                    const conflict =
                      existingPredeterminado
                      && existingPredeterminado.id !== plan?.id;
                    if (conflict) {
                      setConfirmReplacePred(true);
                    } else {
                      setEsPredeterminado(true);
                    }
                  }}
                />
                <span className="plan-editor-toggle-label">
                  Marcar como predeterminado
                </span>
                <span className="plan-editor-toggle-hint">
                  Se mostrará como tu plan principal en la pestaña Entreno
                  y reemplazará al recomendado por los días declarados.
                </span>
              </label>
            </div>

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
                {isBuiltInPlan
                  ? `${planMaxDias} ${planMaxDias === 1 ? 'día' : 'días'} (fijos)`
                  : `${dias.length} / ${planMaxDias} ${planMaxDias === 1 ? 'día' : 'días'}`}
              </span>
            </div>
            {isBuiltInPlan && (
              <p className="plan-editor-builtin-note">
                Los planes 1-7 días tienen un número fijo de días. Para
                ajustar el número de días, crea un plan personalizado.
              </p>
            )}

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
                  aria-label={
                    isBuiltInPlan
                      ? 'No se pueden quitar días en los planes 1-7 días'
                      : `Quitar día ${i + 1}`
                  }
                  // Mín 1 día en custom · builtIns no permiten quitar.
                  disabled={isBuiltInPlan || dias.length <= 1}
                >
                  <MealIcon value="tb:trash" size={16} />
                </button>
              </div>
            ))}

            {/* Botón "Añadir día" · oculto en builtIns (días fijos) ·
                en custom se deshabilita al alcanzar el máximo (7). */}
            {!isBuiltInPlan && (
              <button
                type="button"
                className="plan-editor-add-btn"
                onClick={blurAndRun(addDia)}
                disabled={dias.length >= planMaxDias}
                aria-label={
                  dias.length >= planMaxDias
                    ? `Has alcanzado el máximo de ${planMaxDias} ${
                      planMaxDias === 1 ? 'día' : 'días'
                    } para este plan`
                    : 'Añadir día'
                }
              >
                <MealIcon value="tb:plus" size={18} />
                {dias.length >= planMaxDias
                  ? `Máximo ${planMaxDias} ${planMaxDias === 1 ? 'día' : 'días'}`
                  : 'Añadir día'}
              </button>
            )}

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

      {/* Alert "¿Reemplazar predeterminado?" · al intentar activar
          este toggle si ya hay otro plan marcado como pred. */}
      <IonAlert
        isOpen={confirmReplacePred}
        onDidDismiss={() => setConfirmReplacePred(false)}
        header="¿Reemplazar el predeterminado?"
        message={
          existingPredeterminado
            ? `Ya tienes el plan «${existingPredeterminado.nombre}» marcado como predeterminado.\n\nSi marcas este plan, el anterior dejará de serlo (solo un plan puede ser predeterminado a la vez).`
            : ''
        }
        cssClass="alert-multiline"
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Reemplazar',
            handler: () => {
              setEsPredeterminado(true);
            },
          },
        ]}
      />

      {/* Alert "¿Quitar predeterminado?" · al desmarcar el toggle en
          un plan que YA era predeterminado al abrir el modal. */}
      <IonAlert
        isOpen={confirmRemovePred}
        onDidDismiss={() => setConfirmRemovePred(false)}
        header="¿Quitar el predeterminado?"
        message={
          'Este plan dejará de ser tu predeterminado.\n\nLa recomendación volverá a basarse en los días de entreno declarados en tu perfil.'
        }
        cssClass="alert-multiline"
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Quitar',
            handler: () => {
              setEsPredeterminado(false);
            },
          },
        ]}
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
