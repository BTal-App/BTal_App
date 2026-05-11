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
  MEAL_ICON_DEFAULT,
  type Comida,
  type DayKey,
  type MealKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './MealEditorModal.css';

const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  day: DayKey;
  meal: MealKey;
  comida: Comida;
}

// Editor de comida con flujo manual:
//   1. User edita campos libremente (alimentos, macros, hora) en local state
//   2. Botón "Guardar" abre ConfirmDiffAlert con diff antes/después
//   3. Confirmar → updateMeal a Firestore + cierra todo
//   4. Cancelar/X del confirm → cierra solo la confirmación, vuelve al editor
//   5. X del editor con cambios sin guardar → IonAlert "¿Salir sin guardar?"
//   6. X del editor sin cambios → cierra directo
//
// Marca source='user' automáticamente al guardar (lo hace el provider).
export function MealEditorModal({ isOpen, onClose, day, meal, comida }: Props) {
  const { updateMeal } = useProfile();
  // Hook que encapsula el ciclo idle → saving → saved/error → idle.
  // El status se renderiza inline · ya no usamos ConfirmChangesModal
  // sincronizado con el tiempo real de la escritura a Firestore.
  const { runSave, reset: resetSave } = useSaveStatus();

  // Snapshot original al abrir + state local editable.
  const [original, setOriginal] = useState<Comida>(comida);
  const [local, setLocal] = useState<Comida>(comida);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: Comida;
  } | null>(null);
  const [discardAlertOpen, setDiscardAlertOpen] = useState(false);
  // errorMsg solo se setea (varios handlers limpian/asignan) · pendiente
  // de UI para mostrarlo (toast/banner) · void mantiene la variable sin
  // que TS marque "declared but never read".
  const [errorMsg, setErrorMsg] = useState('');
  void errorMsg;
  // Emoji picker · panel inline desplegable, no modal aparte. Toggleamos
  // con el emoji actual de la card-head para que el user lo encuentre.
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Ref · cuando el user confirma "Salir sin guardar" en el alert,
  // marcamos que el próximo dismiss del IonModal está aprobado, así
  // canDismiss permite cerrar (en lugar de re-abrir el alert).
  const dismissApproved = useRef(false);
  // Ref · timer del cierre tras "Guardado" (1.5s). Lo limpiamos al
  // desmontar y al iniciar otro guardado para evitar cierres dobles.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset al abrir · captura el snapshot del momento de apertura.
  // Sin esto, el `original` se quedaría con la comida de la sesión
  // anterior si el user edita Lunes-Desayuno, cierra, y abre Martes-Comida.
  const resetState = () => {
    setOriginal(comida);
    setLocal(comida);
    setConfirmChanges(null);
    setDiscardAlertOpen(false);
    setErrorMsg('');
    setEmojiOpen(false);
    resetSave();
    dismissApproved.current = false;
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  // Mutador genérico · cualquier setter del form pasa por aquí.
  const change = <K extends keyof Comida>(key: K, value: Comida[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  // Detección de "dirty" superficial · comparamos cada campo relevante.
  const isDirty = useMemo(() => {
    if ((original.nombrePlato ?? '') !== (local.nombrePlato ?? '')) return true;
    if ((original.emoji ?? null) !== (local.emoji ?? null)) return true;
    if (original.hora !== local.hora) return true;
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

  // Pulsar Guardar:
  //   - Si no hay cambios, cerramos sin más.
  //   - Si hay cambios, abrimos confirmación con diff.
  const handleSave = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    setErrorMsg('');
    const cleaned: Comida = local;
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Plato', original.nombrePlato ?? '', cleaned.nombrePlato ?? '');
    pushDiff(changes, 'Hora', original.hora ?? '', cleaned.hora ?? '');
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
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    setErrorMsg('');
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() => updateMeal(day, meal, buildPartial(cleaned)));
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

  // X / arrastrar para cerrar el editor:
  //   - Si hay cambios pendientes, preguntamos antes de descartar.
  //   - Sin cambios, cerramos directo.
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
        // Si el user intenta cerrar (X, arrastre, backdrop) con cambios
        // sin guardar, abrimos el alert "¿Salir sin guardar?" y
        // cancelamos el dismiss devolviendo false. Cuando el user
        // confirma "Salir sin guardar", marcamos dismissApproved y la
        // próxima vez canDismiss devuelve true permitiendo el cierre.
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
                    fallback={MEAL_ICON_DEFAULT[meal]}
                    size={28}
                  />
                </button>
                <div className="meal-editor-id">
                  <h2 className="settings-modal-title">
                    {MEAL_LABEL[meal].toUpperCase()}
                  </h2>
                  <p>{DAY_LABEL_FULL[day]}</p>
                </div>
              </div>

              {/* IconPicker inline · solo cuando el user pulsa el icono
                  del header. onSelect aplica el id Tabler y cierra el
                  panel · onReset vuelve al default (null) y cierra. */}
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
                <span>Nombre del plato</span>
                <input
                  type="text"
                  maxLength={60}
                  placeholder='ej. "Bowl de avena con plátano"'
                  value={local.nombrePlato ?? ''}
                  onChange={(e) => change('nombrePlato', e.target.value || null)}
                />
              </label>

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
                <MacroInput
                  label="kcal"
                  color="kcal"
                  value={local.kcal}
                  onChange={(v) => change('kcal', v)}
                />
                <MacroInput
                  label="proteína (g)"
                  color="prot"
                  value={local.prot}
                  onChange={(v) => change('prot', v)}
                />
                <MacroInput
                  label="carbos (g)"
                  color="carb"
                  value={local.carb}
                  onChange={(v) => change('carb', v)}
                />
                <MacroInput
                  label="grasas (g)"
                  color="fat"
                  value={local.fat}
                  onChange={(v) => change('fat', v)}
                />
              </div>

              <p className="meal-editor-hint">
                Los cambios no se guardan hasta que pulses <strong>Guardar</strong>.
                {isDirty
                  && ' Esta comida quedará marcada como tuya — la IA no la modificará en futuras regeneraciones.'}
              </p>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary meal-editor-save"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSave();
                }}
                disabled={!isDirty}
              >
                <MealIcon value="tb:device-floppy" size={18} slot="start" />
                Guardar
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed meal:', err),
          );
        }}
      />

      {/* Aviso al cerrar con cambios pendientes · disparado por
          canDismiss del IonModal cuando el user intenta cerrar (X,
          arrastre o backdrop) y hay isDirty=true. */}
      <IonAlert
        isOpen={discardAlertOpen}
        onDidDismiss={() => setDiscardAlertOpen(false)}
        header="¿Salir sin guardar?"
        message="Tienes cambios sin guardar en esta comida. Si sales ahora se perderán."
        buttons={[
          { text: 'Seguir editando', role: 'cancel' },
          {
            text: 'Salir sin guardar',
            role: 'destructive',
            handler: () => {
              setDiscardAlertOpen(false);
              // Marca dismiss approved · canDismiss del IonModal verá
              // este flag y permitirá cerrar en el siguiente intento.
              dismissApproved.current = true;
              onClose();
            },
          },
        ]}
      />
    </>
  );
}

// ─── Helpers locales ───────────────────────────────────────────────────────

// Construye el partial que se enviará a Firestore (excluye `source` para
// que ProfileProvider lo marque como 'user' automático).
function buildPartial(data: Comida): Partial<Comida> {
  return {
    alimentos: data.alimentos,
    hora: data.hora,
    kcal: data.kcal,
    prot: data.prot,
    carb: data.carb,
    fat: data.fat,
    // emoji puede ser null (volver al default) · lo enviamos siempre.
    // Firestore acepta null y lo guarda explícito; el render lee
    // <MealIcon value={comida.emoji} fallback={MEAL_ICON_DEFAULT[meal]}/>
    // así que null = default visual.
    emoji: data.emoji ?? null,
    // Nombre del plato · null cuando vacío · la card del menú lee
    // comida.nombrePlato ?? placeholder.
    nombrePlato: data.nombrePlato ?? null,
  };
}

// ─── Sub-componentes locales ───────────────────────────────────────────────

interface MacroInputProps {
  label: string;
  color: 'kcal' | 'prot' | 'carb' | 'fat';
  value: number;
  onChange: (next: number) => void;
}

function MacroInput({ label, color, value, onChange }: MacroInputProps) {
  return (
    <label className={'meal-editor-macro meal-editor-macro--' + color}>
      <span className="meal-editor-macro-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={9999}
        step={1}
        // 4 dígitos máximo · cualquier macro real cabe en 9999 y evita
        // que el campo se desborde visualmente.
        maxLength={4}
        value={value === 0 ? '' : value}
        placeholder="0"
        onKeyDown={blockNonInteger}
        onChange={(e) => onChange(clampInt(e.target.value, 0, 9999))}
      />
    </label>
  );
}
