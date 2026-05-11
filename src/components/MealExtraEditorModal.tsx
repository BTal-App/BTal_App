import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonModal,
} from '@ionic/react';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { blockNonInteger, clampInt } from '../utils/numericInput';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { AlimentosListInput } from './AlimentosListInput';
import { IconPicker } from './IconPicker';
import { MealIcon } from './MealIcon';
import {
  DAY_LABEL_FULL,
  EXTRA_ICON_DEFAULT,
  newExtraId,
  type ComidaExtra,
  type DayKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './MealEditorModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  day: DayKey;
  // null = crear · ComidaExtra = editar uno existente.
  // El padre decide qué pasar y este modal se adapta · header, validación
  // y acción persistente cambian según haya id o no.
  extra: ComidaExtra | null;
  // Callback opcional · si se pasa, aparece el botón "Eliminar comida" al
  // final del editor (solo en modo edit). El padre se encarga del flujo
  // de confirmación + toast de undo.
  onRequestDelete?: (extra: ComidaExtra) => void;
}

// Editor de comidas extras · Sub-fase 2B.5.b. Misma UX que MealEditorModal
// pero con campo NOMBRE editable (las fijas tienen título derivado del
// MealKey · los extras lo tienen libre) y soporta dos modos:
//   - extra=null → crear nueva · al guardar llama a addMealExtra.
//   - extra={…} → editar existente · al guardar llama a updateMealExtra.
//
// El flujo manual es idéntico al de las 4 fijas: edición libre en local,
// botón Guardar abre ConfirmDiffAlert con diff, X con cambios sin
// guardar dispara IonAlert "¿Salir sin guardar?".
export function MealExtraEditorModal({
  isOpen,
  onClose,
  day,
  extra,
  onRequestDelete,
}: Props) {
  const { addMealExtra, updateMealExtra } = useProfile();
  const { runSave, reset: resetSave } = useSaveStatus();

  // Estado base · si estamos creando, snapshot original = "comida vacía"
  // con id nuevo. Al primer save haremos add con ese id. Si estamos
  // editando, snapshot = el extra que viene en props.
  const buildInitial = (): ComidaExtra => {
    if (extra) {
      // Edit mode · normaliza `esExtra` para que el check del editor
      // coincida con lo que la card muestra hoy (legacy = sin campo =
      // visualmente EXTRA → check marcado). Sin esto, abrir un extra
      // antiguo mostraría el check desmarcado pero la card sí dashed.
      return { ...extra, esExtra: extra.esExtra ?? true };
    }
    // Create mode · arranca con el check desmarcado · el user lo
    // activa solo si quiere el aspecto diferenciado (borde dashed +
    // chip EXTRA junto al nombre).
    return {
      id: newExtraId(),
      nombre: '',
      alimentos: [],
      hora: null,
      kcal: 0,
      prot: 0,
      carb: 0,
      fat: 0,
      source: 'user',
      esExtra: false,
    };
  };

  const [original, setOriginal] = useState<ComidaExtra>(buildInitial);
  const [local, setLocal] = useState<ComidaExtra>(buildInitial);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: ComidaExtra;
  } | null>(null);
  const [discardAlertOpen, setDiscardAlertOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const dismissApproved = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const isCreate = extra === null;

  // Reset al abrir · captura el snapshot del momento. Sin esto, reabrir
  // el modal mantendría datos de la sesión anterior.
  const resetState = () => {
    const init = buildInitial();
    setOriginal(init);
    setLocal(init);
    setConfirmChanges(null);
    setDiscardAlertOpen(false);
    setErrorMsg('');
    setEmojiOpen(false);
    resetSave();
    dismissApproved.current = false;
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const change = <K extends keyof ComidaExtra>(
    key: K,
    value: ComidaExtra[K],
  ) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  // En modo editar, "isDirty" = hay diferencia con el snapshot.
  const isDirtyEdit = useMemo(() => {
    if (original.nombre !== local.nombre) return true;
    if ((original.nombrePlato ?? '') !== (local.nombrePlato ?? '')) return true;
    if ((original.emoji ?? null) !== (local.emoji ?? null)) return true;
    if (original.hora !== local.hora) return true;
    if ((original.esExtra ?? true) !== (local.esExtra ?? true)) return true;
    if (original.alimentos.length !== local.alimentos.length) return true;
    for (let i = 0; i < original.alimentos.length; i++) {
      if (original.alimentos[i].nombre !== local.alimentos[i].nombre) return true;
      if (original.alimentos[i].cantidad !== local.alimentos[i].cantidad) return true;
    }
    if (original.kcal !== local.kcal) return true;
    if (original.prot !== local.prot) return true;
    if (original.carb !== local.carb) return true;
    if (original.fat !== local.fat) return true;
    return false;
  }, [original, local]);

  // En modo crear, "isDirty" basta con que tenga nombre o algún alimento.
  // En modo editar, "isDirty" = hay diferencia con el snapshot.
  const isDirty = isCreate
    ? local.nombre.trim() !== ''
      || (local.nombrePlato ?? '').trim() !== ''
      || local.alimentos.length > 0
    : isDirtyEdit;

  // ── Validaciones · campo obligatorio ──────────────────────────────
  // Política actual (post-2026-05): SOLO el título es obligatorio.
  // Plato, alimentos y macros son opcionales · si el user quiere crear
  // una comida solo como recordatorio ("Snack tarde") sin datos, le
  // dejamos. Si no introduce macros, esos quedan en 0 y no afectan al
  // total del día ni a la media semanal (sumar 0 es idempotente).
  const tituloValido = local.nombre.trim() !== '';

  // Lista de campos faltantes · usada para construir el mensaje de error
  // y para deshabilitar el botón Guardar antes del primer click.
  const camposFaltantes: string[] = [];
  if (isCreate) {
    if (!tituloValido) camposFaltantes.push('título');
  }
  const camposOk = camposFaltantes.length === 0;

  const handleSave = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    if (!camposOk) {
      // Mensaje detallado · nombra exactamente los campos que faltan
      // para que el user no tenga que adivinar.
      setErrorMsg(
        'Faltan campos obligatorios: ' + camposFaltantes.join(', ') + '.',
      );
      return;
    }
    setErrorMsg('');
    const cleaned: ComidaExtra = {
      ...local,
      nombre: local.nombre.trim(),
      source: 'user',
    };
    const changes: ChangeEntry[] = [];
    if (isCreate) {
      // En modo create, todo va como '— → valor'. Solo añadimos
      // entradas para campos con CONTENIDO real (evita líneas
      // redundantes tipo "Alimentos: — → 0 alimentos" o
      // "Tipo: — → Comida normal" cuando solo se rellenó el título).
      changes.push({ label: 'Nombre del bloque', from: '—', to: cleaned.nombre || '—' });
      if ((cleaned.nombrePlato ?? '').trim())
        changes.push({ label: 'Plato', from: '—', to: cleaned.nombrePlato ?? '—' });
      if (cleaned.hora) changes.push({ label: 'Hora', from: '—', to: cleaned.hora });
      // Tipo · solo si el user marcó como EXTRA (el default es
      // "Comida normal" · no merece línea de diff).
      if (cleaned.esExtra) {
        changes.push({ label: 'Tipo', from: '—', to: 'EXTRA' });
      }
      // Alimentos · solo si añadió alguno.
      if (cleaned.alimentos.length > 0) {
        changes.push({
          label: 'Alimentos',
          from: '—',
          to: `${cleaned.alimentos.length} alimentos`,
        });
      }
      if (cleaned.kcal) changes.push({ label: 'Kcal', from: '—', to: String(cleaned.kcal) });
      if (cleaned.prot) changes.push({ label: 'Proteína', from: '—', to: String(cleaned.prot) });
      if (cleaned.carb) changes.push({ label: 'Carbos', from: '—', to: String(cleaned.carb) });
      if (cleaned.fat) changes.push({ label: 'Grasa', from: '—', to: String(cleaned.fat) });
    } else {
      pushDiff(changes, 'Nombre del bloque', original.nombre, cleaned.nombre);
      pushDiff(changes, 'Plato', original.nombrePlato ?? '', cleaned.nombrePlato ?? '');
      pushDiff(changes, 'Hora', original.hora ?? '', cleaned.hora ?? '');
      pushDiff(
        changes,
        'Tipo',
        (original.esExtra ?? true) ? 'EXTRA' : 'Comida normal',
        cleaned.esExtra ? 'EXTRA' : 'Comida normal',
      );
      pushDiff(
        changes,
        'Alimentos',
        `${original.alimentos.length} alimentos`,
        `${cleaned.alimentos.length} alimentos`,
      );
      pushDiff(changes, 'Kcal', original.kcal, cleaned.kcal);
      pushDiff(changes, 'Proteína', original.prot, cleaned.prot);
      pushDiff(changes, 'Carbos', original.carb, cleaned.carb);
      pushDiff(changes, 'Grasa', original.fat, cleaned.fat);
    }
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    // Re-validamos justo antes de guardar · el user pudo haber borrado un
    // campo después de pulsar Guardar pero antes de Confirmar.
    if (!camposOk) {
      setErrorMsg(
        'Faltan campos obligatorios: ' + camposFaltantes.join(', ') + '.',
      );
      setConfirmChanges(null);
      return;
    }
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    setErrorMsg('');
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(async () => {
      if (isCreate) {
        await addMealExtra(day, cleaned);
      } else {
        await updateMealExtra(day, cleaned.id, cleaned);
      }
    });
    if (result === SAVE_FAILED) {
      setErrorMsg(
        'No hemos podido guardar. Comprueba tu conexión y vuelve a intentarlo.',
      );
      return;
    }
    dismissApproved.current = true;
    closeTimer.current = setTimeout(() => {
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  const handleClose = () => {
    if (isDirty) {
      setDiscardAlertOpen(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal meal-editor"
        canDismiss={async () => {
          if (!isDirty) return true;
          if (dismissApproved.current) return true;
          setDiscardAlertOpen(true);
          return false;
        }}
      >
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card meal-editor-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleClose();
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
              <div className="meal-editor-head">
                <button
                  type="button"
                  className="meal-editor-emoji meal-editor-emoji--clickable"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    setEmojiOpen((v) => !v);
                  }}
                  aria-label="Cambiar icono"
                  aria-expanded={emojiOpen}
                >
                  <MealIcon
                    value={local.emoji}
                    fallback={EXTRA_ICON_DEFAULT}
                    size={28}
                  />
                </button>
                <div className="meal-editor-id">
                  <h2 className="settings-modal-title">
                    {isCreate
                      ? 'NUEVA COMIDA'
                      : (local.nombre.trim() || 'EDITAR COMIDA').toUpperCase()}
                  </h2>
                  <p>{DAY_LABEL_FULL[day]}</p>
                </div>
              </div>

              {emojiOpen && (
                <div className="meal-editor-emoji-panel">
                  <IconPicker
                    selected={local.emoji ?? null}
                    onSelect={(id) => {
                      change('emoji', id);
                      setEmojiOpen(false);
                    }}
                    onReset={
                      local.emoji
                        ? () => {
                            change('emoji', null);
                            setEmojiOpen(false);
                          }
                        : undefined
                    }
                  />
                </div>
              )}

              <label className="onboarding-field">
                <span>
                  Título
                  {' '}
                  <span className="meal-editor-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  type="text"
                  maxLength={50}
                  placeholder='ej. "PRE-ENTRENO"'
                  value={local.nombre}
                  onChange={(e) => change('nombre', e.target.value)}
                  // Mostrar el input en mayúsculas mientras se escribe ·
                  // el dato se guarda igualmente como lo escribió el user
                  // (si pone "Pre-entreno", se guarda así · solo el
                  // visual del input lo pone en uppercase). En el resto
                  // de superficies (header del modal, card del menú) lo
                  // mostramos también uppercase.
                  style={{ textTransform: 'uppercase' }}
                />
              </label>

              <label className="onboarding-field">
                <span>Nombre del plato</span>
                <input
                  type="text"
                  maxLength={60}
                  placeholder='ej. "Plátano y café"'
                  value={local.nombrePlato ?? ''}
                  onChange={(e) =>
                    change('nombrePlato', e.target.value || null)
                  }
                />
              </label>

              {/* Check "Marcar como EXTRA" · cambia el aspecto visual
                  de la card en el menú. Marcado = borde dashed +
                  chip "EXTRA"; desmarcado = card normal como las
                  fijas (desayuno/comida/...). El dato sigue
                  guardándose en el array `extras` del día (no se
                  convierte en una comida fija). */}
              <label className="meal-editor-extra-check">
                <input
                  type="checkbox"
                  checked={!!local.esExtra}
                  onChange={(e) => change('esExtra', e.target.checked)}
                />
                <span className="meal-editor-extra-check-label">
                  Marcar como EXTRA
                </span>
              </label>
              <p className="meal-editor-extra-hint">
                Si lo marcas, la comida aparece en el menú con un borde
                discontinuo y una etiqueta <strong>EXTRA</strong> para
                distinguirla de las comidas principales (desayuno,
                comida, merienda, cena). Si lo dejas sin marcar, se
                muestra como una comida más del día.
              </p>

              <label className="onboarding-field">
                <span>
                  <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}>
                    <MealIcon value="tb:clock" size={14} />
                  </span>
                  Hora (opcional)
                </span>
                <span className="sup-input-time">
                  <input
                    type="time"
                    value={local.hora ?? ''}
                    onChange={(e) => change('hora', e.target.value || null)}
                  />
                  <MealIcon
                    value="tb:clock"
                    size={16}
                    className="sup-input-time-icon"
                  />
                </span>
              </label>

              <div>
                <span className="onboarding-field-label">Alimentos</span>
                <AlimentosListInput
                  value={local.alimentos}
                  onChange={(next) => change('alimentos', next)}
                  ariaLabelPrefix="Alimento"
                />
              </div>

              <span className="onboarding-field-label">Macros</span>
              <div className="meal-editor-macros">
                <MacroInputExtra
                  label="kcal"
                  color="kcal"
                  value={local.kcal}
                  onChange={(v) => change('kcal', v)}
                />
                <MacroInputExtra
                  label="proteína (g)"
                  color="prot"
                  value={local.prot}
                  onChange={(v) => change('prot', v)}
                />
                <MacroInputExtra
                  label="carbos (g)"
                  color="carb"
                  value={local.carb}
                  onChange={(v) => change('carb', v)}
                />
                <MacroInputExtra
                  label="grasas (g)"
                  color="fat"
                  value={local.fat}
                  onChange={(v) => change('fat', v)}
                />
              </div>

              <p className="meal-editor-hint">
                Los cambios no se guardan hasta que pulses{' '}
                <strong>Guardar</strong>.
                {isCreate && (
                  <>
                    <br />
                    Solo el <span className="meal-editor-required">*</span>{' '}
                    <strong>título</strong> es obligatorio. Los demás
                    campos son opcionales · si no añades macros, esta
                    comida no sumará al total del día ni a la media
                    semanal.
                  </>
                )}
              </p>

              {errorMsg && (
                <div className="landing-msg error" style={{ marginBottom: 8 }}>
                  {errorMsg}
                </div>
              )}

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary meal-editor-save"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSave();
                }}
                // Disabled si: nada que guardar (no dirty) o, en modo
                // crear, faltan campos obligatorios. En modo editar el
                // botón siempre se habilita si hay cambios · permitimos
                // editar campos sueltos sin reexigir todos.
                disabled={!isDirty || (isCreate && !camposOk)}
              >
                <MealIcon value="tb:device-floppy" size={18} slot="start" />
                {isCreate ? 'Crear comida' : 'Guardar'}
              </IonButton>

              {/* Botón Eliminar · solo si estamos editando uno existente
                  Y el padre nos pasó el callback. Click marca dismiss
                  approved (no preguntamos "salir sin guardar") + cierra
                  el editor + delega la confirmación al padre, que muestra
                  IonAlert y luego IonToast con "Deshacer". */}
              {!isCreate && extra && onRequestDelete && (
                <IonButton
                  type="button"
                  expand="block"
                  fill="outline"
                  className="meal-editor-delete"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    dismissApproved.current = true;
                    onClose();
                    // Damos tiempo a que el modal cierre antes de abrir
                    // el alert · evita el solape de modales en Ionic.
                    setTimeout(() => onRequestDelete(extra), 60);
                  }}
                >
                  Eliminar comida
                </IonButton>
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
            console.error('[BTal] persistConfirmed meal extra:', err),
          );
        }}
      />

      <IonAlert
        isOpen={discardAlertOpen}
        onDidDismiss={() => setDiscardAlertOpen(false)}
        header="¿Salir sin guardar?"
        message={
          isCreate
            ? 'Si sales ahora la nueva comida no se creará.'
            : 'Tienes cambios sin guardar en esta comida. Si sales ahora se perderán.'
        }
        buttons={[
          { text: 'Seguir editando', role: 'cancel' },
          {
            text: 'Salir sin guardar',
            role: 'destructive',
            handler: () => {
              setDiscardAlertOpen(false);
              dismissApproved.current = true;
              onClose();
            },
          },
        ]}
      />
    </>
  );
}

// ─── Sub-componentes locales ───────────────────────────────────────────────

interface MacroInputProps {
  label: string;
  color: 'kcal' | 'prot' | 'carb' | 'fat';
  value: number;
  onChange: (next: number) => void;
}

function MacroInputExtra({ label, color, value, onChange }: MacroInputProps) {
  return (
    <label className={'meal-editor-macro meal-editor-macro--' + color}>
      <span className="meal-editor-macro-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={9999}
        step={1}
        maxLength={4}
        value={value === 0 ? '' : value}
        placeholder="0"
        onKeyDown={blockNonInteger}
        onChange={(e) => onChange(clampInt(e.target.value, 0, 9999))}
      />
    </label>
  );
}
