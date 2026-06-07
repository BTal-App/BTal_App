import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { SaveIndicator } from './SaveIndicator';
import { AlimentosListInput } from './AlimentosListInput';
import { macrosFromAlimentos } from '../utils/mealMacros';
import { blockNonInteger, clampInt } from '../utils/numericInput';
import {
  DAY_LABEL_FULL,
  hasBatidoDayRecipe,
  SUP_HORA_DEFECTO,
  SUP_TITULO_DEFECTO,
  type Alimento,
  type DayKey,
  type SupDayOverride,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Día y suplemento que estamos editando.
  day: DayKey;
  kind: 'batido' | 'creatina';
}

// Editor de mini-card · Sub-fase 2B.5.a (extensión post-feedback). Permite
// override del título y la hora SOLO para ese día concreto. Si el user
// vacía ambos campos, guardamos null y la mini-card vuelve a los defaults
// globales. También botón "Quitar del día" para eliminar la mini-card.
export function SupCardEditor({ isOpen, onClose, day, kind }: Props) {
  const {
    profile: userDoc,
    setSupOverride,
    toggleSupInDay,
  } = useProfile();
  const overrides =
    kind === 'batido'
      ? userDoc?.suplementos.batidoOverrides
      : userDoc?.suplementos.creatinaOverrides;
  const current = overrides?.[day];
  // Receta global del batido · base para "Personalizar este día" y referencia
  // del diff (lo que usa el día cuando NO hay receta propia).
  const globalBatido = userDoc?.suplementos.batidoConfig;

  // Defaults para placeholder · usados también si el user vacía el campo.
  const defaultHora =
    kind === 'batido' ? SUP_HORA_DEFECTO.batido : SUP_HORA_DEFECTO.creatina;
  const defaultTitulo =
    kind === 'batido'
      ? SUP_TITULO_DEFECTO.batido
      : SUP_TITULO_DEFECTO.creatina;

  // Form state · arranca con los valores override (o defaults si no hay).
  const [titulo, setTitulo] = useState(current?.titulo ?? '');
  const [hora, setHora] = useState(current?.hora ?? defaultHora);

  // ── Receta por-día (solo batido) ──────────────────────────────────────
  // `customizeDay` = el user quiere una receta propia para ESTE día (override
  // de ingredientes + macros). Si false, la mini-card usa la receta global.
  // El form de receta se siembra de la receta del día (si ya hay override) o,
  // al activar la personalización, de la receta global como base.
  const [customizeDay, setCustomizeDay] = useState(false);
  const [recAlimentos, setRecAlimentos] = useState<Alimento[]>([]);
  const [recKcal, setRecKcal] = useState(0);
  const [recProt, setRecProt] = useState(0);
  const [recCarb, setRecCarb] = useState(0);
  const [recFat, setRecFat] = useState(0);

  const [savedToast, setSavedToast] = useState(false);
  const [removedToast, setRemovedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: { override: SupDayOverride | null };
  } | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  const [removing, setRemoving] = useState(false);

  // Cleanup del setTimeout post-éxito.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset al abrir · siempre arrancamos con la versión del doc actual.
  const resetState = () => {
    setTitulo(current?.titulo ?? '');
    setHora(current?.hora ?? defaultHora);
    // Receta del día · si el override ya trae una, la cargamos y activamos
    // la personalización; si no, sembramos el form con la receta global como
    // base para cuando el user pulse "Personalizar este día".
    if (kind === 'batido' && hasBatidoDayRecipe(current)) {
      setCustomizeDay(true);
      setRecAlimentos(current?.alimentos ?? []);
      setRecKcal(current?.kcal ?? 0);
      setRecProt(current?.prot ?? 0);
      setRecCarb(current?.carb ?? 0);
      setRecFat(current?.fat ?? 0);
    } else {
      setCustomizeDay(false);
      setRecAlimentos(globalBatido?.alimentos ?? []);
      setRecKcal(globalBatido?.kcal ?? 0);
      setRecProt(globalBatido?.prot ?? 0);
      setRecCarb(globalBatido?.carb ?? 0);
      setRecFat(globalBatido?.fat ?? 0);
    }
    setSavedToast(false);
    setRemovedToast(false);
    setConfirmChanges(null);
    resetSave();
  };

  // Cambio de ingredientes de la receta del día · ajusta los macros por la
  // DIFERENCIA de la contribución de los alimentos con macros reales,
  // preservando lo que el user haya tecleado a mano (igual que BatidoInfoModal).
  const changeRecAlimentos = (next: Alimento[]) => {
    const before = macrosFromAlimentos(recAlimentos);
    const after = macrosFromAlimentos(next);
    setRecAlimentos(next);
    setRecKcal((v) => Math.max(0, v + (after.kcal - before.kcal)));
    setRecProt((v) => Math.max(0, v + (after.prot - before.prot)));
    setRecCarb((v) => Math.max(0, v + (after.carb - before.carb)));
    setRecFat((v) => Math.max(0, v + (after.fat - before.fat)));
  };

  // Activa la personalización del día · re-siembra el form desde la receta
  // global (base de partida) para que el user edite a partir de ahí.
  const startCustomize = () => {
    setRecAlimentos(globalBatido?.alimentos ?? []);
    setRecKcal(globalBatido?.kcal ?? 0);
    setRecProt(globalBatido?.prot ?? 0);
    setRecCarb(globalBatido?.carb ?? 0);
    setRecFat(globalBatido?.fat ?? 0);
    setCustomizeDay(true);
  };

  // Validación de hora · acepta HH:mm en 24h, vacío también vale (default).
  const horaValida =
    hora === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);

  const handleSave = () => {
    if (!horaValida || submitting) return;

    // Construimos el override · solo guardamos campos que se desvían del
    // default. Si ambos coinciden con el default, guardamos null para
    // borrar la entrada y mantener Firestore limpio.
    const tituloFinal = titulo.trim();
    const tituloDeviates =
      tituloFinal !== '' && tituloFinal !== defaultTitulo;
    const horaFinal = hora.trim();
    const horaDeviates = horaFinal !== '' && horaFinal !== defaultHora;

    // Receta del día · solo el batido la puede personalizar. Si el user la
    // activó, incluimos ingredientes + macros en el override; si no, se
    // omiten y la mini-card cae a la receta global.
    const recipeOn = kind === 'batido' && customizeDay;
    const recipeFields = recipeOn
      ? {
          alimentos: recAlimentos,
          kcal: recKcal,
          prot: recProt,
          carb: recCarb,
          fat: recFat,
        }
      : {};

    const override: SupDayOverride | null =
      tituloDeviates || horaDeviates || recipeOn
        ? {
            titulo: tituloDeviates ? tituloFinal : null,
            hora: horaDeviates ? horaFinal : null,
            ...recipeFields,
          }
        : null;

    // Modo edit si ya había override (el usuario entra a modificarlo).
    const isEditOverride = current !== undefined && current !== null;
    const beforeTitulo = current?.titulo ?? defaultTitulo;
    const beforeHora = current?.hora ?? defaultHora;
    const afterTitulo = override?.titulo ?? defaultTitulo;
    const afterHora = override?.hora ?? defaultHora;

    const changes: ChangeEntry[] = [];
    if (isEditOverride) {
      pushDiff(changes, 'Título', beforeTitulo, afterTitulo);
      pushDiff(changes, 'Hora', beforeHora, afterHora);
    } else {
      if (afterTitulo !== defaultTitulo)
        changes.push({ label: 'Título', from: '—', to: afterTitulo });
      if (afterHora !== defaultHora)
        changes.push({ label: 'Hora', from: '—', to: afterHora });
    }

    // Diff de la receta del día (solo batido) · "Global" vs "Personalizada"
    // + macros/ingredientes cuando la personalizada está activa.
    if (kind === 'batido') {
      const wasCustom = hasBatidoDayRecipe(current);
      pushDiff(
        changes,
        'Receta del día',
        wasCustom ? 'Personalizada' : 'Receta global',
        recipeOn ? 'Personalizada' : 'Receta global',
      );
      if (recipeOn) {
        const beforeAl = wasCustom
          ? (current?.alimentos ?? [])
          : (globalBatido?.alimentos ?? []);
        const beforeK = wasCustom ? (current?.kcal ?? 0) : (globalBatido?.kcal ?? 0);
        const beforeP = wasCustom ? (current?.prot ?? 0) : (globalBatido?.prot ?? 0);
        const beforeC = wasCustom ? (current?.carb ?? 0) : (globalBatido?.carb ?? 0);
        const beforeF = wasCustom ? (current?.fat ?? 0) : (globalBatido?.fat ?? 0);
        pushDiff(
          changes,
          'Ingredientes',
          `${beforeAl.length} ingredientes`,
          `${recAlimentos.length} ingredientes`,
        );
        pushDiff(changes, 'Kcal', beforeK, recKcal);
        pushDiff(changes, 'Proteína', beforeP, recProt);
        pushDiff(changes, 'Carbos', beforeC, recCarb);
        pushDiff(changes, 'Grasa', beforeF, recFat);
      }
    }
    setConfirmChanges({ changes, cleaned: { override } });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const { override } = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() =>
      setSupOverride(kind, day, override),
    );
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  // Quitar del día · llamamos a toggleSupInDay con on=false. También
  // borramos cualquier override existente (no tiene sentido que persistan
  // sin el día activo). Cerramos el modal y mostramos toast.
  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await toggleSupInDay(kind, day, false);
      // Si había override, limpiamos también · idempotente si no había.
      if (current !== undefined) {
        await setSupOverride(kind, day, null);
      }
      setRemovedToast(true);
      onClose();
    } catch (err) {
      console.error('[BTal] handleRemove sup error:', err);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
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
              <h2
                className={
                  'settings-modal-title '
                  + (kind === 'batido' ? 'sup-title-batido' : 'sup-title-creatina')
                }
              >
                <MealIcon
                  value={kind === 'batido' ? 'tb:cup' : 'tb:ladle'}
                  size={22}
                  className="sup-title-icon"
                />
                {kind === 'batido' ? 'Editar batido' : 'Editar creatina'}
              </h2>
              <p className="settings-modal-text">
                Ajusta la hora y el título solo para el{' '}
                {DAY_LABEL_FULL[day].toLowerCase()}. Si los dejas en blanco
                se usarán los valores por defecto.
                {kind === 'batido' && (
                  <> También puedes usar una receta de batido distinta solo
                  este día.</>
                )}
              </p>

              <div className="sup-form-group">
                <label className="sup-label">Título</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={50}
                  placeholder={defaultTitulo}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Hora</label>
                <div className="sup-input-time">
                  <input
                    className="sup-input"
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                  <MealIcon
                    value="tb:clock"
                    size={16}
                    className="sup-input-time-icon"
                  />
                </div>
                {!horaValida && (
                  <span className="sup-input-error">Formato HH:mm</span>
                )}
              </div>

              {/* Receta del día · solo batido. Permite un batido distinto este
                  día (ingredientes + macros) sin tocar la receta global. */}
              {kind === 'batido' && (
                <div className="sup-day-recipe">
                  <div className="sup-section-head">
                    <span className="sup-section-label">Receta de este día</span>
                    {customizeDay ? (
                      <button
                        type="button"
                        className="sup-config-btn"
                        onClick={(e) => {
                          (e.currentTarget as HTMLElement).blur();
                          setCustomizeDay(false);
                        }}
                      >
                        <MealIcon value="tb:arrow-back-up" size={16} />
                        Volver a la global
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sup-config-btn"
                        onClick={(e) => {
                          (e.currentTarget as HTMLElement).blur();
                          startCustomize();
                        }}
                      >
                        <MealIcon value="tb:wand" size={16} />
                        Personalizar
                      </button>
                    )}
                  </div>

                  {!customizeDay ? (
                    <p className="sup-macro-hint">
                      Este día usa la <strong>receta global</strong> del batido.
                      Pulsa «Personalizar» para usar otros ingredientes o macros
                      solo el {DAY_LABEL_FULL[day].toLowerCase()}.
                    </p>
                  ) : (
                    <>
                      <div className="sup-form-group">
                        <label className="sup-label">
                          Ingredientes (leche, fruta, avena…)
                        </label>
                        <AlimentosListInput
                          value={recAlimentos}
                          onChange={changeRecAlimentos}
                          ariaLabelPrefix="Ingrediente del batido de este día"
                        />
                      </div>

                      <div className="sup-form-label-section">
                        Macros de este batido
                      </div>
                      <p className="sup-macro-hint">
                        Se calculan a partir de los ingredientes con macros reales
                        (buscador) · puedes ajustarlos a mano.
                      </p>
                      <div className="sup-macro-grid">
                        <div className="sup-form-group">
                          <label className="sup-label sup-label--kcal">kcal</label>
                          <input
                            className="sup-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            step={1}
                            maxLength={4}
                            value={recKcal === 0 ? '' : recKcal}
                            placeholder="0"
                            onKeyDown={blockNonInteger}
                            onChange={(e) =>
                              setRecKcal(clampInt(e.target.value, 0, 9999))
                            }
                          />
                        </div>
                        <div className="sup-form-group">
                          <label className="sup-label sup-label--prot">Prot (g)</label>
                          <input
                            className="sup-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            step={1}
                            maxLength={4}
                            value={recProt === 0 ? '' : recProt}
                            placeholder="0"
                            onKeyDown={blockNonInteger}
                            onChange={(e) =>
                              setRecProt(clampInt(e.target.value, 0, 9999))
                            }
                          />
                        </div>
                        <div className="sup-form-group">
                          <label className="sup-label sup-label--carb">Carb (g)</label>
                          <input
                            className="sup-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            step={1}
                            maxLength={4}
                            value={recCarb === 0 ? '' : recCarb}
                            placeholder="0"
                            onKeyDown={blockNonInteger}
                            onChange={(e) =>
                              setRecCarb(clampInt(e.target.value, 0, 9999))
                            }
                          />
                        </div>
                        <div className="sup-form-group">
                          <label className="sup-label sup-label--fat">Grasas (g)</label>
                          <input
                            className="sup-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            step={1}
                            maxLength={4}
                            value={recFat === 0 ? '' : recFat}
                            placeholder="0"
                            onKeyDown={blockNonInteger}
                            onChange={(e) =>
                              setRecFat(clampInt(e.target.value, 0, 9999))
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleSave();
                }}
                disabled={!horaValida || submitting}
              >
                Guardar cambios
              </IonButton>

              <div className="sup-divider" aria-hidden="true" />

              <button
                type="button"
                className="sup-day-btn sup-day-btn--remove"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleRemove();
                }}
                disabled={removing}
              >
                <MealIcon value="tb:circle-minus" size={18} />
                Quitar del {DAY_LABEL_FULL[day].toLowerCase()}
              </button>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed sup card:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Mini-card actualizada"
        duration={2000}
        position="bottom"
        color="success"
      />
      <IonToast
        isOpen={removedToast}
        onDidDismiss={() => setRemovedToast(false)}
        message={
          kind === 'batido'
            ? 'Batido quitado del día'
            : 'Creatina quitada del día'
        }
        duration={2000}
        position="bottom"
        color="medium"
      />
    </>
  );
}
