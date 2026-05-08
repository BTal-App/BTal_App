import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
} from '@ionic/react';
import {
  closeOutline,
  saveOutline,
  timeOutline,
} from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { blockNonInteger, clampInt } from '../utils/numericInput';
import { AlimentosListInput } from './AlimentosListInput';
import { EmojiPicker } from './EmojiPicker';
import {
  ConfirmChangesModal,
  type Change,
} from './ConfirmChangesModal';
import {
  formatAlimento,
  type Alimento,
  type Comida,
  type DayKey,
  type MealKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './MealEditorModal.css';

const MEAL_EMOJI: Record<MealKey, string> = {
  desayuno: '🌅',
  comida: '☀️',
  merienda: '🍎',
  cena: '🌙',
};

const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

const DAY_LABEL_FULL: Record<DayKey, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
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
//   2. Botón "Guardar" abre ConfirmChangesModal con diff antes/después
//   3. Confirmar → updateMeal a Firestore + cierra todo
//   4. Cancelar/X del confirm → cierra solo la confirmación, vuelve al editor
//   5. X del editor con cambios sin guardar → IonAlert "¿Salir sin guardar?"
//   6. X del editor sin cambios → cierra directo
//
// Marca source='user' automáticamente al guardar (lo hace el provider).
export function MealEditorModal({ isOpen, onClose, day, meal, comida }: Props) {
  const { updateMeal } = useProfile();
  // Hook que encapsula el ciclo idle → saving → saved/error → idle.
  // El status se pasa al ConfirmChangesModal para mostrar el SaveIndicator
  // sincronizado con el tiempo real de la escritura a Firestore.
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();

  // Snapshot original al abrir + state local editable.
  const [original, setOriginal] = useState<Comida>(comida);
  const [local, setLocal] = useState<Comida>(comida);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardAlertOpen, setDiscardAlertOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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
    setConfirmOpen(false);
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

  // Calcula los cambios entre original y local para mostrar el diff.
  const changes = useMemo<Change[]>(
    () => buildChanges(original, local),
    [original, local],
  );

  const isDirty = changes.length > 0;

  // Pulsar Guardar:
  //   - Si no hay cambios, cerramos sin más.
  //   - Si hay cambios, abrimos confirmación con diff.
  const handleSave = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    setErrorMsg('');
    setConfirmOpen(true);
  };

  // Confirmar desde el modal de confirmación · persiste y cierra todo.
  // El runSave del hook gestiona el ciclo "Guardando…/Guardado/Error"
  // sincronizado con el tiempo real de Firestore. Tras éxito esperamos
  // SAVED_INDICATOR_MS para que el chip "Guardado" sea visible antes de
  // cerrar el modal · si falla, el chip "Error" se queda 3s y dejamos el
  // modal abierto para reintentar.
  const handleConfirmSave = async () => {
    if (!isDirty) {
      setConfirmOpen(false);
      onClose();
      return;
    }
    setErrorMsg('');
    // Cancelamos cualquier cierre pendiente (caso reintentar tras fallo).
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() => updateMeal(day, meal, buildPartial(local)));
    if (result === SAVE_FAILED) {
      // Falló · el hook ya marcó status='error', SaveIndicator lo muestra.
      setErrorMsg(
        'No hemos podido guardar. Comprueba tu conexión y vuelve a intentarlo.',
      );
      return;
    }
    // Éxito · marca dismiss approved (canDismiss permitirá cerrar) y
    // espera a que el chip "Guardado" se vea antes del cierre real.
    dismissApproved.current = true;
    closeTimer.current = setTimeout(() => {
      setConfirmOpen(false);
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
        <button
          type="button"
          className="settings-modal-close settings-modal-close--fixed"
          onClick={(e) => {
            e.currentTarget.blur();
            handleClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card meal-editor-card">
              <div className="meal-editor-head">
                <button
                  type="button"
                  className="meal-editor-emoji meal-editor-emoji--clickable"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    setEmojiOpen((v) => !v);
                  }}
                  aria-label="Cambiar emoji"
                  aria-expanded={emojiOpen}
                >
                  {local.emoji ?? MEAL_EMOJI[meal]}
                </button>
                <div className="meal-editor-id">
                  <h2 className="settings-modal-title">
                    {MEAL_LABEL[meal].toUpperCase()}
                  </h2>
                  <p>{DAY_LABEL_FULL[day]}</p>
                </div>
              </div>

              {/* EmojiPicker inline · solo cuando el user pulsa el emoji.
                  onSelect aplica el emoji y cierra el panel · onReset
                  vuelve al default y cierra. */}
              {emojiOpen && (
                <div className="meal-editor-emoji-panel">
                  <EmojiPicker
                    selected={local.emoji ?? null}
                    onSelect={(em) => {
                      change('emoji', em);
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
                  <IonIcon
                    icon={timeOutline}
                    style={{ verticalAlign: 'middle', fontSize: '0.9rem', marginRight: 4 }}
                  />
                  Hora (opcional)
                </span>
                <input
                  type="time"
                  value={local.hora ?? ''}
                  onChange={(e) => change('hora', e.target.value || null)}
                />
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
                <IonIcon icon={saveOutline} slot="start" />
                Guardar
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Modal de confirmación con diff · solo se monta cuando se pulsa Guardar */}
      {confirmOpen && (
        <ConfirmChangesModal
          isOpen={confirmOpen}
          changes={changes}
          status={saveStatus}
          errorMsg={errorMsg}
          title="¿Guardar los cambios?"
          description="Vas a actualizar esta comida. Si confirmas, se guardará y la IA no la modificará en futuras regeneraciones."
          onCancel={() => {
            if (saveStatus === 'saving') return;
            setConfirmOpen(false);
          }}
          onConfirm={() => void handleConfirmSave()}
        />
      )}

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
    // comida.emoji ?? MEAL_EMOJI[meal] así que null = default.
    emoji: data.emoji ?? null,
    // Nombre del plato · null cuando vacío · la card del menú lee
    // comida.nombrePlato ?? placeholder.
    nombrePlato: data.nombrePlato ?? null,
  };
}

// Compara dos arrays de Alimento (mismo orden) por contenido exacto.
function sameAlimentos(a: Alimento[], b: Alimento[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].nombre !== b[i].nombre) return false;
    if (a[i].cantidad !== b[i].cantidad) return false;
  }
  return true;
}

// Calcula los cambios entre la versión original y la editada para
// mostrarlos en ConfirmChangesModal. Solo incluye campos que han
// cambiado realmente.
function buildChanges(before: Comida, after: Comida): Change[] {
  const out: Change[] = [];
  // nombrePlato · null/undefined/empty se comparan como "—" para que
  // el diff no aparezca cuando solo cambia entre null y "" (ambos vacíos).
  const beforeNombre = (before.nombrePlato ?? '').trim();
  const afterNombre = (after.nombrePlato ?? '').trim();
  if (beforeNombre !== afterNombre) {
    out.push({
      label: 'Nombre del plato',
      before: beforeNombre || '—',
      after: afterNombre || '—',
    });
  }
  // emoji · null/undefined = default · normalizamos antes de comparar.
  const beforeEmoji = before.emoji ?? null;
  const afterEmoji = after.emoji ?? null;
  if (beforeEmoji !== afterEmoji) {
    out.push({
      label: 'Emoji',
      before: beforeEmoji ?? '— (por defecto)',
      after: afterEmoji ?? '— (por defecto)',
    });
  }
  if (before.hora !== after.hora) {
    out.push({
      label: 'Hora',
      before: before.hora ?? '—',
      after: after.hora ?? '—',
    });
  }
  if (!sameAlimentos(before.alimentos, after.alimentos)) {
    out.push({
      label: 'Alimentos',
      before: before.alimentos.length > 0
        ? before.alimentos.map(formatAlimento).join(' · ')
        : '—',
      after: after.alimentos.length > 0
        ? after.alimentos.map(formatAlimento).join(' · ')
        : '—',
    });
  }
  if (before.kcal !== after.kcal) {
    out.push({ label: 'Calorías', before: `${before.kcal} kcal`, after: `${after.kcal} kcal` });
  }
  if (before.prot !== after.prot) {
    out.push({ label: 'Proteína', before: `${before.prot} g`, after: `${after.prot} g` });
  }
  if (before.carb !== after.carb) {
    out.push({ label: 'Carbohidratos', before: `${before.carb} g`, after: `${after.carb} g` });
  }
  if (before.fat !== after.fat) {
    out.push({ label: 'Grasas', before: `${before.fat} g`, after: `${after.fat} g` });
  }
  return out;
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
