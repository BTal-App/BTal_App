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
  newExtraId,
  type Alimento,
  type ComidaExtra,
  type DayKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './MealEditorModal.css';

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
// botón Guardar abre ConfirmChangesModal con diff, X con cambios sin
// guardar dispara IonAlert "¿Salir sin guardar?".
export function MealExtraEditorModal({
  isOpen,
  onClose,
  day,
  extra,
  onRequestDelete,
}: Props) {
  const { addMealExtra, updateMealExtra } = useProfile();
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();

  // Estado base · si estamos creando, snapshot original = "comida vacía"
  // con id nuevo. Al primer save haremos add con ese id. Si estamos
  // editando, snapshot = el extra que viene en props.
  const buildInitial = (): ComidaExtra =>
    extra ?? {
      id: newExtraId(),
      nombre: '',
      alimentos: [],
      hora: null,
      kcal: 0,
      prot: 0,
      carb: 0,
      fat: 0,
      source: 'user',
    };

  const [original, setOriginal] = useState<ComidaExtra>(buildInitial);
  const [local, setLocal] = useState<ComidaExtra>(buildInitial);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    setConfirmOpen(false);
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

  const changes = useMemo<Change[]>(
    () => buildExtraChanges(original, local, isCreate),
    [original, local, isCreate],
  );

  // En modo crear, "isDirty" basta con que tenga nombre o algún alimento.
  // En modo editar, "isDirty" = hay diferencia con el snapshot.
  const isDirty = isCreate
    ? local.nombre.trim() !== ''
      || (local.nombrePlato ?? '').trim() !== ''
      || local.alimentos.length > 0
    : changes.length > 0;

  // ── Validaciones de campos obligatorios ─────────────────────────────
  // En modo CREAR exigimos: nombre · nombrePlato · ≥1 alimento (sin
  // necesidad de cantidad) · kcal > 0. Los demás macros son opcionales
  // porque a veces son 0 reales (un café solo no tiene carb ni grasa).
  // En modo EDITAR no aplicamos · si el user ya tenía datos buenos y
  // quiere borrar algún campo, le dejamos (puede tener razón al hacerlo).
  const nombreValido = local.nombre.trim() !== '';
  const nombrePlatoValido = (local.nombrePlato ?? '').trim() !== '';
  const tieneAlimento = local.alimentos.some(
    (a) => a.nombre.trim() !== '',
  );
  const kcalValido = local.kcal > 0;

  // Lista de campos faltantes · usada para construir el mensaje de error
  // y para deshabilitar el botón Guardar antes incluso del primer click.
  const camposFaltantes: string[] = [];
  if (isCreate) {
    if (!nombreValido) camposFaltantes.push('nombre de la comida');
    if (!nombrePlatoValido) camposFaltantes.push('nombre del plato');
    if (!tieneAlimento) camposFaltantes.push('al menos un alimento');
    if (!kcalValido) camposFaltantes.push('calorías (kcal)');
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
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!isDirty) {
      setConfirmOpen(false);
      onClose();
      return;
    }
    // Re-validamos justo antes de guardar · el user pudo haber borrado un
    // campo después de pulsar Guardar pero antes de Confirmar.
    if (!camposOk) {
      setErrorMsg(
        'Faltan campos obligatorios: ' + camposFaltantes.join(', ') + '.',
      );
      setConfirmOpen(false);
      return;
    }
    setErrorMsg('');
    if (closeTimer.current) clearTimeout(closeTimer.current);

    const result = await runSave(async () => {
      const payload: ComidaExtra = {
        ...local,
        nombre: local.nombre.trim(),
        // Toda creación / edición desde el cliente va como source='user'.
        source: 'user',
      };
      if (isCreate) {
        await addMealExtra(day, payload);
      } else {
        // updateMealExtra hace el merge por id.
        await updateMealExtra(day, payload.id, payload);
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
      setConfirmOpen(false);
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
                  {local.emoji ?? '🍽'}
                </button>
                <div className="meal-editor-id">
                  <h2 className="settings-modal-title">
                    {isCreate
                      ? 'NUEVA COMIDA EXTRA'
                      : (local.nombre.trim() || 'EDITAR COMIDA').toUpperCase()}
                  </h2>
                  <p>{DAY_LABEL_FULL[day]}</p>
                </div>
              </div>

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
                <span>Nombre</span>
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
                    Para crear una comida nueva son obligatorios:{' '}
                    <strong>nombre</strong>, <strong>nombre del plato</strong>,
                    al menos <strong>un alimento</strong> y las{' '}
                    <strong>kcal</strong>.
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
                <IonIcon icon={saveOutline} slot="start" />
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

      {confirmOpen && (
        <ConfirmChangesModal
          isOpen={confirmOpen}
          changes={changes}
          status={saveStatus}
          errorMsg={errorMsg}
          title={isCreate ? '¿Crear esta comida?' : '¿Guardar los cambios?'}
          description={
            isCreate
              ? 'Vas a crear una nueva comida en este día.'
              : 'Vas a actualizar esta comida.'
          }
          onCancel={() => {
            if (saveStatus === 'saving') return;
            setConfirmOpen(false);
          }}
          onConfirm={() => void handleConfirmSave()}
        />
      )}

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

// ─── Helpers locales ───────────────────────────────────────────────────────

function sameAlimentos(a: Alimento[], b: Alimento[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].nombre !== b[i].nombre) return false;
    if (a[i].cantidad !== b[i].cantidad) return false;
  }
  return true;
}

// Diff entre original y editado · igual estructura que el helper de
// MealEditorModal, pero incluye el campo nombre. En modo crear NO
// mostramos diff (sería todo "—" → algo) · el ConfirmChangesModal
// debería mostrar solo los campos rellenos. Lo hacemos pasando false-y
// como `before` para que se muestre como "—".
function buildExtraChanges(
  before: ComidaExtra,
  after: ComidaExtra,
  isCreate: boolean,
): Change[] {
  const out: Change[] = [];
  if (isCreate || before.nombre !== after.nombre) {
    out.push({
      label: 'Nombre',
      before: before.nombre || '—',
      after: after.nombre || '—',
    });
  }
  const beforePlato = (before.nombrePlato ?? '').trim();
  const afterPlato = (after.nombrePlato ?? '').trim();
  if (isCreate || beforePlato !== afterPlato) {
    out.push({
      label: 'Nombre del plato',
      before: beforePlato || '—',
      after: afterPlato || '—',
    });
  }
  // emoji · default 🍽 si null/undefined.
  const beforeEmoji = before.emoji ?? null;
  const afterEmoji = after.emoji ?? null;
  if (beforeEmoji !== afterEmoji) {
    out.push({
      label: 'Emoji',
      before: beforeEmoji ?? '🍽',
      after: afterEmoji ?? '🍽',
    });
  }
  if (isCreate || before.hora !== after.hora) {
    out.push({
      label: 'Hora',
      before: before.hora ?? '—',
      after: after.hora ?? '—',
    });
  }
  if (isCreate || !sameAlimentos(before.alimentos, after.alimentos)) {
    out.push({
      label: 'Alimentos',
      before:
        before.alimentos.length > 0
          ? before.alimentos.map(formatAlimento).join(' · ')
          : '—',
      after:
        after.alimentos.length > 0
          ? after.alimentos.map(formatAlimento).join(' · ')
          : '—',
    });
  }
  if (isCreate || before.kcal !== after.kcal) {
    out.push({ label: 'Calorías', before: `${before.kcal} kcal`, after: `${after.kcal} kcal` });
  }
  if (isCreate || before.prot !== after.prot) {
    out.push({ label: 'Proteína', before: `${before.prot} g`, after: `${after.prot} g` });
  }
  if (isCreate || before.carb !== after.carb) {
    out.push({ label: 'Carbohidratos', before: `${before.carb} g`, after: `${after.carb} g` });
  }
  if (isCreate || before.fat !== after.fat) {
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
