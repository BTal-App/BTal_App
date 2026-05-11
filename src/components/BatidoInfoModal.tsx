import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
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
import { blockNonInteger, clampInt } from '../utils/numericInput';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { SaveIndicator } from './SaveIndicator';
import { SupCountersInline } from './SupCountersInline';
import {
  DAY_LABEL_FULL,
  type BatidoConfig,
  type DayKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Día actualmente seleccionado en MenuPage · contexto para el botón
  // "Añadir/Quitar al día". El usuario sigue navegando por días con el
  // sheet abierto cerrado · este día se fija al abrir el modal.
  day: DayKey;
}

// Modal info del batido protéico · Sub-fase 2B.5.a.
//
// Vista por defecto: receta global + botón toggle para añadir/quitar
// del día actual + botón "⚙ Configurar" que abre la sub-vista de edición.
//
// Sub-vista edición: form con gr proteína, checkbox creatina dentro,
// extras (texto), 4 macros. Guardar y volver a info, o cancelar.
export function BatidoInfoModal({ isOpen, onClose, day }: Props) {
  const {
    profile: userDoc,
    toggleSupInDay,
    setBatidoConfig,
  } = useProfile();
  const sup = userDoc?.suplementos;
  const config = sup?.batidoConfig;
  const dayHasIt = sup?.daysWithBatido.includes(day) ?? false;

  // 'info' = lectura · 'edit' = editando la receta. Conmuta al pulsar
  // ⚙ Configurar · resetear al cerrar el modal.
  const [view, setView] = useState<'info' | 'edit'>('info');

  // Form state de la edición · solo se rellena cuando entras en 'edit'.
  const [form, setForm] = useState<BatidoConfig | null>(null);

  const [savedToast, setSavedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: BatidoConfig;
  } | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  // Estado del toggle día (independiente del save de la receta global).
  const [toggling, setToggling] = useState(false);
  // Confirmación previa al toggle · IonAlert que pregunta antes de
  // añadir/quitar para evitar pulsaciones accidentales.
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);

  // Cleanup del setTimeout post-éxito al guardar la receta.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const resetState = () => {
    setView('info');
    setForm(null);
    setSavedToast(false);
    setToggleConfirmOpen(false);
    setConfirmChanges(null);
    resetSave();
  };

  const enterEdit = () => {
    if (!config) return;
    setForm({ ...config });
    resetSave();
    setView('edit');
  };

  const cancelEdit = () => {
    setForm(null);
    setView('info');
  };

  const updateForm = <K extends keyof BatidoConfig>(
    key: K,
    value: BatidoConfig[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // Formatea precio para diff · "12,90 €" o "—" si null/0.
  const fmtPrecio = (p: number | null): string =>
    p === null || p === undefined
      ? '—'
      : `${p.toFixed(2).replace('.', ',')} €`;

  // Construye changes y abre el confirm · la receta siempre es edit
  // (el config ya existe) así que comparamos campo a campo.
  const handleSaveConfig = () => {
    if (!form || submitting || !config) return;
    const cleaned: BatidoConfig = { ...form };
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Producto', config.producto_nombre, cleaned.producto_nombre);
    pushDiff(
      changes,
      'Precio bote',
      fmtPrecio(config.producto_precio),
      fmtPrecio(cleaned.producto_precio),
    );
    pushDiff(changes, 'Gramos proteína', config.gr_prot, cleaned.gr_prot);
    pushDiff(
      changes,
      'Incluye creatina',
      config.includeCreatina ? 'Sí' : 'No',
      cleaned.includeCreatina ? 'Sí' : 'No',
    );
    pushDiff(changes, 'Extras', config.extras, cleaned.extras);
    pushDiff(changes, 'Kcal', config.kcal, cleaned.kcal);
    pushDiff(changes, 'Proteína', config.prot, cleaned.prot);
    pushDiff(changes, 'Carbos', config.carb, cleaned.carb);
    pushDiff(changes, 'Grasa', config.fat, cleaned.fat);
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() => setBatidoConfig(cleaned));
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      setView('info');
      setForm(null);
    }, SAVED_INDICATOR_MS);
  };

  // Pulsar el botón "+ Añadir / − Quitar" abre IonAlert de confirmación
  // en lugar de toggle directo · evita pulsaciones accidentales (sobre
  // todo en mobile donde el botón es ancho).
  const askToggleConfirm = () => {
    if (toggling) return;
    setToggleConfirmOpen(true);
  };

  // Ejecuta el toggle real tras confirmar. Sin SaveIndicator (acción
  // atómica con optimistic update · feedback visual inmediato). Si falla
  // revertimos vía provider y dejamos un log; el caso común (red OK) es
  // invisible al user porque el ✓/borde verde aparece al instante.
  const doToggleDay = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleSupInDay('batido', day, !dayHasIt);
    } catch (err) {
      console.error('[BTal] toggleSupInDay batido error:', err);
    } finally {
      setToggling(false);
    }
  };

  // Si el doc aún no se cargó (caso raro · el modal solo se abre desde
  // MenuPage que ya tiene el doc), evitamos pintar para no acceder a config
  // null. El IonModal sigue montado para que la animación de cierre fluya.
  if (!config) {
    return (
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal" />
    );
  }

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
              {/* Botón X DENTRO del card como primer hijo · su `position:
                  absolute` se ancla al card mismo (que tiene position:
                  relative), garantizando que la X queda dentro del
                  recuadro independientemente del viewport o IonModal. */}
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
              {view === 'info' ? (
                <>
                  <h2 className="settings-modal-title sup-title-batido">
                    <MealIcon value="tb:cup" size={22} className="sup-title-icon" />
                    BATIDO PROTÉICO
                  </h2>
                  <p className="settings-modal-text">
                    Añade el batido como comida extra del{' '}
                    {DAY_LABEL_FULL[day].toLowerCase()}, o configura la
                    receta y los macros.
                  </p>

                  {/* Toggle día */}
                  <button
                    type="button"
                    className={
                      'sup-day-btn sup-day-btn--batido'
                      + (dayHasIt ? ' sup-day-btn--remove' : '')
                    }
                    onClick={(e) => {
                      (e.currentTarget as HTMLElement).blur();
                      askToggleConfirm();
                    }}
                    disabled={toggling}
                  >
                    <MealIcon
                      value={dayHasIt ? 'tb:circle-minus' : 'tb:circle-plus'}
                      size={20}
                    />
                    {dayHasIt
                      ? `Quitar del ${DAY_LABEL_FULL[day].toLowerCase()}`
                      : `Añadir al ${DAY_LABEL_FULL[day].toLowerCase()}`}
                  </button>

                  {/* Receta */}
                  <div className="sup-section-head">
                    <span className="sup-section-label">Receta diaria</span>
                    <button
                      type="button"
                      className="sup-config-btn"
                      onClick={(e) => {
                        (e.currentTarget as HTMLElement).blur();
                        enterEdit();
                      }}
                    >
                      <MealIcon value="tb:settings" size={16} />
                      Configurar
                    </button>
                  </div>
                  <p className="sup-recipe">
                    <strong>{config.gr_prot} g</strong> de proteína
                    {config.includeCreatina && (
                      <>
                        {' + '}
                        <strong>
                          {userDoc?.suplementos?.creatinaConfig?.gr_dose ?? 3} g
                        </strong>
                        {' '}de creatina
                      </>
                    )}
                    {config.extras && (
                      <>
                        {' + '}
                        <span className="sup-recipe-extras">{config.extras}</span>
                      </>
                    )}
                  </p>

                  {/* Macros del batido completo */}
                  <div className="sup-macros">
                    <span className="menu-macro-pill menu-macro-pill--kcal">
                      <MealIcon value="tb:flame" size={14} />
                      {config.kcal} kcal
                    </span>
                    <span className="menu-macro-pill menu-macro-pill--prot">
                      <MealIcon value="tb:barbell" size={14} />
                      {config.prot}g P
                    </span>
                    <span className="menu-macro-pill menu-macro-pill--carb">
                      <MealIcon value="tb:leaf" size={14} />
                      {config.carb}g C
                    </span>
                    <span className="menu-macro-pill menu-macro-pill--fat">
                      <MealIcon value="tb:droplet" size={14} />
                      {config.fat}g G
                    </span>
                  </div>

                  <p className="sup-footnote">
                    <MealIcon value="tb:cup" size={14} />
                    Estos macros son los del batido entero (proteína suplementaria
                    + creatina + extras). Edítalos en Configurar para que cuadren con
                    tu producto exacto.
                  </p>

                  {/* Contadores inline · igual que v1 modal-batido-info.
                      Counter ±1, métricas (posibles/restantes/semana/mes)
                      y resets. Los datos del producto (nombre, precio,
                      gramos del bote) viven en Compra → 💪 SUPLEMENTACIÓN. */}
                  <SupCountersInline kind="batido" />

                </>
              ) : (
                form && (
                  <>
                    <h2 className="settings-modal-title sup-title-batido">
                      <MealIcon value="tb:settings" size={22} className="sup-title-icon" />
                      CONFIGURAR BATIDO
                    </h2>

                    {/* Form fields */}
                    <div className="sup-form-group">
                      <label className="sup-label sup-label--batido">
                        g Proteína por batido
                      </label>
                      <input
                        className="sup-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={200}
                        step={1}
                        maxLength={3}
                        value={form.gr_prot === 0 ? '' : form.gr_prot}
                        placeholder="35"
                        onKeyDown={blockNonInteger}
                        onChange={(e) =>
                          updateForm('gr_prot', clampInt(e.target.value, 0, 200))
                        }
                      />
                    </div>

                    <label className="sup-checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.includeCreatina}
                        onChange={(e) =>
                          updateForm('includeCreatina', e.target.checked)
                        }
                      />
                      <span>
                        <MealIcon value="tb:ladle" size={16} className="sup-inline-icon" />
                        Añadir creatina al batido{' '}
                        <span className="sup-checkbox-sub">
                          (usa la dosis configurada en{' '}
                          <MealIcon value="tb:ladle" size={14} className="sup-inline-icon-sm" />
                          Creatina)
                        </span>
                      </span>
                    </label>

                    <div className="sup-form-group">
                      <label className="sup-label">Extras (texto libre)</label>
                      <textarea
                        className="sup-input sup-textarea"
                        placeholder="ej: 1 plátano + 300 ml leche semi"
                        rows={2}
                        maxLength={200}
                        value={form.extras}
                        onChange={(e) => updateForm('extras', e.target.value)}
                      />
                    </div>

                    <div className="sup-form-label-section">
                      Macros por batido
                    </div>
                    <div className="sup-macro-grid">
                      <div className="sup-form-group">
                        <label className="sup-label sup-label--kcal">
                          kcal
                        </label>
                        <input
                          className="sup-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9999}
                          step={1}
                          maxLength={4}
                          value={form.kcal === 0 ? '' : form.kcal}
                          placeholder="0"
                          onKeyDown={blockNonInteger}
                          onChange={(e) =>
                            updateForm('kcal', clampInt(e.target.value, 0, 9999))
                          }
                        />
                      </div>
                      <div className="sup-form-group">
                        <label className="sup-label sup-label--prot">
                          Prot (g)
                        </label>
                        <input
                          className="sup-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9999}
                          step={1}
                          maxLength={4}
                          value={form.prot === 0 ? '' : form.prot}
                          placeholder="0"
                          onKeyDown={blockNonInteger}
                          onChange={(e) =>
                            updateForm('prot', clampInt(e.target.value, 0, 9999))
                          }
                        />
                      </div>
                      <div className="sup-form-group">
                        <label className="sup-label sup-label--carb">
                          Carb (g)
                        </label>
                        <input
                          className="sup-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9999}
                          step={1}
                          maxLength={4}
                          value={form.carb === 0 ? '' : form.carb}
                          placeholder="0"
                          onKeyDown={blockNonInteger}
                          onChange={(e) =>
                            updateForm('carb', clampInt(e.target.value, 0, 9999))
                          }
                        />
                      </div>
                      <div className="sup-form-group">
                        <label className="sup-label sup-label--fat">
                          Grasas (g)
                        </label>
                        <input
                          className="sup-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9999}
                          step={1}
                          maxLength={4}
                          value={form.fat === 0 ? '' : form.fat}
                          placeholder="0"
                          onKeyDown={blockNonInteger}
                          onChange={(e) =>
                            updateForm('fat', clampInt(e.target.value, 0, 9999))
                          }
                        />
                      </div>
                    </div>

                    <div className="save-indicator-wrap">
                      <SaveIndicator status={saveStatus} />
                    </div>

                    <div className="sup-actions">
                      <IonButton
                        type="button"
                        fill="outline"
                        className="sup-action-cancel"
                        onClick={(e) => {
                          (e.currentTarget as HTMLElement).blur();
                          cancelEdit();
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
                          handleSaveConfig();
                        }}
                        disabled={submitting}
                      >
                        Guardar
                      </IonButton>
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </IonContent>
      </IonModal>

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed batido:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Batido actualizado"
        duration={2000}
        position="bottom"
        color="success"
      />

      {/* Confirmación previa al toggle día · evita añadir/quitar por
          accidente. Mensaje cambia según sea añadir o quitar. */}
      <IonAlert
        isOpen={toggleConfirmOpen}
        onDidDismiss={() => setToggleConfirmOpen(false)}
        header={
          dayHasIt
            ? `¿Quitar el batido del ${DAY_LABEL_FULL[day].toLowerCase()}?`
            : `¿Añadir el batido al ${DAY_LABEL_FULL[day].toLowerCase()}?`
        }
        message={
          dayHasIt
            ? 'Se eliminará del listado de comidas de ese día. Podrás volver a añadirlo cuando quieras.'
            : 'Se añadirá como comida extra del día con la receta que tengas configurada arriba.'
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: dayHasIt ? 'Quitar' : 'Añadir',
            role: dayHasIt ? 'destructive' : 'confirm',
            handler: () => {
              doToggleDay().catch((err) => {
                console.error('[BTal] doToggleDay batido unhandled:', err);
              });
            },
          },
        ]}
      />
    </>
  );
}
