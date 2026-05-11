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
  type CreatinaConfig,
  type DayKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  day: DayKey;
}

// Modal info de la creatina · Sub-fase 2B.5.a · estructura paralela al
// BatidoInfoModal (info / edit toggleable, toggle día, save indicator).
// La creatina solo tiene gr_dose y notas · más sencillo que el batido.
export function CreatinaInfoModal({ isOpen, onClose, day }: Props) {
  const {
    profile: userDoc,
    toggleSupInDay,
    setCreatinaConfig,
  } = useProfile();
  const sup = userDoc?.suplementos;
  const config = sup?.creatinaConfig;
  const dayHasIt = sup?.daysWithCreatina.includes(day) ?? false;

  const [view, setView] = useState<'info' | 'edit'>('info');
  const [form, setForm] = useState<CreatinaConfig | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: CreatinaConfig;
  } | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  const [toggling, setToggling] = useState(false);
  // Confirmación previa al toggle (igual que BatidoInfoModal · evita
  // pulsaciones accidentales).
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);

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

  const updateForm = <K extends keyof CreatinaConfig>(
    key: K,
    value: CreatinaConfig[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const fmtPrecio = (p: number | null): string =>
    p === null || p === undefined
      ? '—'
      : `${p.toFixed(2).replace('.', ',')} €`;

  const handleSaveConfig = () => {
    if (!form || submitting || !config) return;
    const cleaned: CreatinaConfig = { ...form };
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Producto', config.producto_nombre, cleaned.producto_nombre);
    pushDiff(
      changes,
      'Precio bote',
      fmtPrecio(config.producto_precio),
      fmtPrecio(cleaned.producto_precio),
    );
    pushDiff(changes, 'Gramos por dosis', config.gr_dose, cleaned.gr_dose);
    pushDiff(changes, 'Notas', config.notas, cleaned.notas);
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() => setCreatinaConfig(cleaned));
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      setView('info');
      setForm(null);
    }, SAVED_INDICATOR_MS);
  };

  const askToggleConfirm = () => {
    if (toggling) return;
    setToggleConfirmOpen(true);
  };

  const doToggleDay = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleSupInDay('creatina', day, !dayHasIt);
    } catch (err) {
      console.error('[BTal] toggleSupInDay creatina error:', err);
    } finally {
      setToggling(false);
    }
  };

  if (!config) {
    return (
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal" />
    );
  }

  // Si la creatina ya está incluida en el batido del mismo día, avisamos
  // al user para que sepa que sumar creatina suelta sería doble dosis.
  const includedInBatidoToday =
    sup?.batidoConfig.includeCreatina && sup?.daysWithBatido.includes(day);

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
              {view === 'info' ? (
                <>
                  <h2 className="settings-modal-title sup-title-creatina">
                    <MealIcon value="tb:ladle" size={22} className="sup-title-icon" />
                    CREATINA
                  </h2>
                  <p className="settings-modal-text">
                    Añade una dosis suelta como comida extra del{' '}
                    {DAY_LABEL_FULL[day].toLowerCase()}, o ajusta los gramos
                    por dosis.
                  </p>

                  {includedInBatidoToday && !dayHasIt && (
                    <p className="sup-warning-soft">
                      <MealIcon value="tb:info-circle" size={16} className="sup-inline-icon" />
                      El batido de hoy ya incluye creatina. Añadir una dosis
                      suelta sería duplicar.
                    </p>
                  )}

                  <button
                    type="button"
                    className={
                      'sup-day-btn sup-day-btn--creatina'
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

                  <div className="sup-section-head">
                    <span className="sup-section-label">Dosis</span>
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
                    <strong>{config.gr_dose} g</strong> por dosis
                    {config.notas && (
                      <>
                        {' · '}
                        <span className="sup-recipe-extras">{config.notas}</span>
                      </>
                    )}
                  </p>

                  {/* Contadores inline · counter ±1, métricas (posibles/
                      restantes/semana/mes) y resets. Los datos del
                      producto comprado viven en Compra → 💪 SUPLEMENTACIÓN. */}
                  <SupCountersInline kind="creatina" />

                </>
              ) : (
                form && (
                  <>
                    <h2 className="settings-modal-title sup-title-creatina">
                      <MealIcon value="tb:settings" size={22} className="sup-title-icon" />
                      CONFIGURAR CREATINA
                    </h2>

                    <div className="sup-form-group">
                      <label className="sup-label sup-label--creatina">
                        g Creatina por dosis
                      </label>
                      <input
                        className="sup-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        step={1}
                        maxLength={2}
                        value={form.gr_dose === 0 ? '' : form.gr_dose}
                        placeholder="3"
                        onKeyDown={blockNonInteger}
                        onChange={(e) =>
                          updateForm('gr_dose', clampInt(e.target.value, 0, 50))
                        }
                      />
                    </div>

                    <div className="sup-form-group">
                      <label className="sup-label">Notas (texto libre)</label>
                      <textarea
                        className="sup-input sup-textarea"
                        placeholder="ej: con agua / antes del entreno"
                        rows={2}
                        maxLength={200}
                        value={form.notas}
                        onChange={(e) => updateForm('notas', e.target.value)}
                      />
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
            console.error('[BTal] persistConfirmed creatina:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Creatina actualizada"
        duration={2000}
        position="bottom"
        color="success"
      />

      {/* Confirmación previa al toggle día · igual que en batido. */}
      <IonAlert
        isOpen={toggleConfirmOpen}
        onDidDismiss={() => setToggleConfirmOpen(false)}
        header={
          dayHasIt
            ? `¿Quitar la creatina del ${DAY_LABEL_FULL[day].toLowerCase()}?`
            : `¿Añadir la creatina al ${DAY_LABEL_FULL[day].toLowerCase()}?`
        }
        message={
          dayHasIt
            ? 'Se eliminará del listado de comidas de ese día. Podrás volver a añadirla cuando quieras.'
            : 'Se añadirá como dosis suelta del día con los gramos que tengas configurados arriba.'
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: dayHasIt ? 'Quitar' : 'Añadir',
            role: dayHasIt ? 'destructive' : 'confirm',
            handler: () => {
              doToggleDay().catch((err) => {
                console.error('[BTal] doToggleDay creatina unhandled:', err);
              });
            },
          },
        ]}
      />
    </>
  );
}
