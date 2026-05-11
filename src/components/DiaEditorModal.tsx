import { useRef, useState, type ReactNode } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import {
  type DayKey,
  type DiaEntreno,
  type EjercicioBadge,
  type Ejercicio,
} from '../templates/defaultUser';
import {
  BADGE_GROUPS,
  BADGE_BY_VAL,
  CUSTOM_EXERCISE_SENTINEL,
  EXERCISES_BY_TYPE,
  getGroupedSuggestedExercises,
} from '../templates/exerciseCatalog';
import { DAY_OPTIONS } from '../utils/diaSemana';
import { diffDia, type ChangeEntry } from '../utils/entrenoDiff';
// formatTiempoEstimado/parseTiempoEstimado se siguen usando solo para
// el badge de la card (display) y otros consumidores · aquí (editor)
// trabajamos con campos h/min separados para una UX más limpia.
import { blurAndRun } from '../utils/focus';
import {
  SAVE_FAILED,
  SAVED_INDICATOR_MS,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { SaveIndicator } from './SaveIndicator';
import {
  formatSeries,
  isFreeFormatSeries,
  numOptions,
  parseSeries,
} from '../utils/seriesParser';
import './SettingsModal.css';
import './SupModal.css';
import './DiaEditorModal.css';

// Editor inline de un día del plan de entreno · réplica del v1
// (peAddDay + peExRowHTML). El user edita: título, descripción, día
// semana, hasta 3 badges (slot1 obligatorio, 2-3 opcionales, 'custom'
// abre un input de texto libre), comentario y lista de ejercicios.
//
// El `onSave` recibe el DiaEntreno completo · el caller (EntrenoPage)
// hace el `updateDiaEntreno` al provider con optimistic update + revert.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dia: DiaEntreno;
  diaIdx: number;
  onSave: (dia: DiaEntreno) => Promise<void> | void;
  // Callback de borrado · si se pasa, aparece el botón "Eliminar día"
  // al final del modal con confirmación previa. Si es undefined, el
  // botón no se renderiza (caso edge: solo queda 1 día → no permitir
  // dejar el plan vacío).
  onDelete?: () => Promise<void> | void;
}

const TITULO_MAX = 50;
const DESC_MAX = 50;
const BADGE_CUSTOM_MAX = 20;
const EJ_NOMBRE_MAX = 60;
const EJ_DESC_MAX = 60;
// Cap en 10 chars · suficiente para "AMRAP", "30 min", "60s", "Tabata"
// y similares. Antes 16 daba pie a strings excesivamente largos que
// rompían el layout horizontal del bloque series.
const EJ_SERIES_MAX = 10;

// Opciones para los <select> de series y reps · réplica del v1.
const SERIES_OPTIONS = numOptions(100);
const REPS_OPTIONS = numOptions(300);

export function DiaEditorModal({
  isOpen,
  onClose,
  dia,
  diaIdx,
  onSave,
  onDelete,
}: Props) {
  const [local, setLocal] = useState<DiaEntreno>(dia);
  // status del ciclo idle/saving/saved/error · alimenta SaveIndicator
  // y reemplaza al `submitting` boolean que solo bloqueaba botones.
  const { status, runSave, reset: resetSave } = useSaveStatus();
  const submitting = status === 'saving';
  // Toast "Día guardado" tras éxito + cierre tras 1.5s · réplica del
  // patrón de MealEditor / BatidoInfo.
  const [savedToast, setSavedToast] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // IonAlert "Faltan campos obligatorios" · réplica del v1 a nivel de
  // día. Si el title vacío, el plan completo no se podría guardar
  // (savePlanModal lo bloquearía), así que mismo bloqueo aquí.
  const [missingAlert, setMissingAlert] = useState<string[] | null>(null);
  // IonAlert "¿Confirmar cambios?" con diff antes/después · réplica
  // del v1 confirmSave. Guardamos el día limpio para persistirlo si
  // el user pulsa "Guardar" en la confirmación.
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: DiaEntreno;
  } | null>(null);
  // Confirmación borrar ejercicio · réplica del v1 (peDelEx con
  // mobileConfirm). Guardamos el índice del ejercicio pendiente.
  const [confirmDeleteEj, setConfirmDeleteEj] = useState<number | null>(null);
  // Confirmación borrar día completo · réplica del v1 (peDelDay con
  // mobileConfirm). Solo aplica si el caller proporcionó onDelete.
  const [confirmDeleteDia, setConfirmDeleteDia] = useState(false);
  // Editor estructurado de duración del entreno · 2 modos:
  //  - 'min': un solo input numérico (minutos totales)
  //  - 'hm':  dos inputs (horas y minutos por separado)
  // El state se serializa al guardar como `tiempoEstimadoMin` (total
  // en minutos). Heurística inicial: si el día ya tenía valor >= 60
  // arrancamos en 'hm'; si era < 60 o null en 'min'.
  const initialTiempoState = (): {
    mode: 'min' | 'hm';
    horas: string;
    minutos: string;
  } => {
    const t = dia.tiempoEstimadoMin;
    if (t === null || t === undefined) {
      return { mode: 'min', horas: '', minutos: '' };
    }
    if (t >= 60) {
      return {
        mode: 'hm',
        horas: String(Math.floor(t / 60)),
        minutos: String(t % 60),
      };
    }
    return { mode: 'min', horas: '', minutos: String(t) };
  };
  const [tiempoMode, setTiempoMode] = useState<'min' | 'hm'>(
    () => initialTiempoState().mode,
  );
  const [tiempoHoras, setTiempoHoras] = useState<string>(
    () => initialTiempoState().horas,
  );
  const [tiempoMinutos, setTiempoMinutos] = useState<string>(
    () => initialTiempoState().minutos,
  );

  // Reset al re-abrir el modal con un día distinto · evitamos arrastrar
  // edits no guardados de un día anterior.
  const handleWillPresent = () => {
    setLocal(dia);
    // Reinicia el editor de duración con la heurística inicial.
    const ti = initialTiempoState();
    setTiempoMode(ti.mode);
    setTiempoHoras(ti.horas);
    setTiempoMinutos(ti.minutos);
    resetSave();
    setMissingAlert(null);
    setConfirmChanges(null);
    setSavedToast(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const update = <K extends keyof DiaEntreno>(field: K, value: DiaEntreno[K]) =>
    setLocal((cur) => ({ ...cur, [field]: value }));

  const addEjercicio = () => {
    setLocal((cur) => ({
      ...cur,
      ejercicios: [
        ...cur.ejercicios,
        { nombre: '', desc: '', series: '', source: 'user' as const },
      ],
    }));
  };

  const updateEjercicio = (idx: number, partial: Partial<Ejercicio>) => {
    setLocal((cur) => {
      const ejercicios = [...cur.ejercicios];
      ejercicios[idx] = { ...ejercicios[idx], ...partial, source: 'user' };
      return { ...cur, ejercicios };
    });
  };

  const requestRemoveEjercicio = (idx: number) => {
    setConfirmDeleteEj(idx);
  };

  const confirmRemoveEjercicio = () => {
    if (confirmDeleteEj === null) return;
    const idx = confirmDeleteEj;
    setLocal((cur) => ({
      ...cur,
      ejercicios: cur.ejercicios.filter((_, i) => i !== idx),
    }));
    setConfirmDeleteEj(null);
  };

  const handleSave = async () => {
    if (submitting) return;
    // Validación · título + tipo principal + al menos un ejercicio
    // con nombre. El resto (descripción, duración, badge2/3,
    // notas, comentario) es opcional.
    const missing: string[] = [];
    if (!local.titulo.trim()) {
      missing.push('Título del día');
    }
    // Tipo principal: badge debe estar seleccionado · si es 'custom'
    // se requiere también texto en badgeCustom.
    if (!local.badge) {
      missing.push('Tipo principal');
    } else if (local.badge === 'custom' && !local.badgeCustom.trim()) {
      missing.push('Tipo principal (nombre del tipo personalizado)');
    }
    // Al menos un ejercicio con nombre · ejercicios sin nombre se
    // filtran al guardar, así que pedimos al user que ponga al menos 1.
    const ejerciciosConNombre = local.ejercicios.filter(
      (ej) => ej.nombre.trim().length > 0,
    );
    if (ejerciciosConNombre.length === 0) {
      missing.push('Al menos un ejercicio (nombre)');
    }
    if (missing.length > 0) {
      setMissingAlert(missing);
      return;
    }
    // Cálculo de tiempoEstimadoMin desde los inputs separados.
    // 'min': solo minutos. 'hm': horas*60 + minutos.
    // Resultado 0 → null (sin valor · igual que campo vacío).
    const horas = parseInt(tiempoHoras, 10) || 0;
    const mins = parseInt(tiempoMinutos, 10) || 0;
    const totalMin
      = tiempoMode === 'hm' ? horas * 60 + mins : mins;

    // Limpieza: trim + filtrado de ejercicios vacíos (sin nombre)
    const cleaned: DiaEntreno = {
      ...local,
      titulo: local.titulo.trim(),
      descripcion: local.descripcion.trim(),
      tiempoEstimadoMin: totalMin > 0 ? totalMin : null,
      comentario: local.comentario.trim(),
      badgeCustom: local.badgeCustom.trim(),
      badgeCustom2: local.badgeCustom2.trim(),
      badgeCustom3: local.badgeCustom3.trim(),
      ejercicios: local.ejercicios
        .map((ej) => ({
          ...ej,
          nombre: ej.nombre.trim(),
          desc: ej.desc.trim(),
          series: ej.series.trim(),
        }))
        .filter((ej) => ej.nombre.length > 0),
      // Marcamos el día como user-modified · la IA no lo regenera al
      // siguiente generatePlan (Fase 6).
      source: 'user',
    };
    // Construye diff antes/después · si no hay cambios, mostramos
    // alert "Sin cambios" sin botón guardar; en otro caso mostramos
    // la confirmación con la lista. Réplica del v1 confirmSave.
    const changes = diffDia(dia, cleaned, diaIdx);
    setConfirmChanges({ changes, cleaned });
  };

  // Persistencia tras confirmar el diff. Envuelta en `runSave` para
  // que el SaveIndicator muestre "Guardando…" → "Guardado" durante
  // todo el ciclo (igual que MealEditor / BatidoInfo). Tras éxito,
  // toast + cierre con 1.5s de delay para que el user vea el chip
  // "Guardado". En error queda visible el chip "Error" 3s.
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

  // Grupos de ejercicios sugeridos para el <select> · réplica del v1
  // `peExerciseSelectHTML`: solo los grupos correspondientes a los
  // badges del día (máx 3). Si no hay badges válidos, mostramos todos.
  const suggestedGroups = getGroupedSuggestedExercises([
    local.badge,
    local.badge2,
    local.badge3,
  ]);

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
              Editar DÍA {diaIdx + 1}
            </h2>

            <div className="sup-form-group">
              <label className="sup-label">
                Título del día
                <span className="dia-editor-required">*</span>
              </label>
              <input
                className={
                  'sup-input'
                  + (!local.titulo.trim()
                    ? ' dia-editor-input--missing'
                    : '')
                }
                type="text"
                maxLength={TITULO_MAX}
                placeholder='ej. "Día A · Empuje"'
                value={local.titulo}
                onChange={(e) => update('titulo', e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="sup-form-group">
              <label className="sup-label">Día de la semana</label>
              <select
                className="sup-input dia-editor-select"
                value={local.diaSemana ?? ''}
                onChange={(e) =>
                  update('diaSemana', (e.target.value || null) as DayKey | null)
                }
              >
                <option value="">— Sin asignar —</option>
                {/* Optgroup "DÍA" en amarillo · coherente con los
                    selectores de tipo y ejercicio que ya usan
                    optgroup amarillo (réplica del v1 #ffd54f).
                    Labels en uppercase para coherencia visual con
                    el badge "LUN/MAR/..." que se renderiza en la
                    card del día. */}
                <optgroup label="Día">
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.val} value={d.val}>
                      {d.label.toUpperCase()}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Descripción corta */}
            <div className="sup-form-group">
              <label className="sup-label">Descripción</label>
              <input
                className="sup-input"
                type="text"
                maxLength={DESC_MAX}
                placeholder='ej. "Pecho · Tríceps · Hombros"'
                value={local.descripcion}
                onChange={(e) => update('descripcion', e.target.value)}
              />
            </div>

            {/* Duración del entreno · editor estructurado. Toggle entre
                "Sólo min" y "H + min" · según el modo, mostramos 1 o 2
                inputs numéricos. Evita que el user pueda escribir texto
                arbitrario; al guardar serializamos como total en
                minutos. Réplica del UX típico de timers. */}
            <div className="sup-form-group">
              <label className="sup-label">Duración del entreno</label>
              <div className="dia-editor-tiempo-toggle">
                <button
                  type="button"
                  className={
                    'dia-editor-tiempo-tab'
                    + (tiempoMode === 'hm'
                      ? ' dia-editor-tiempo-tab--active'
                      : '')
                  }
                  onClick={blurAndRun(() => {
                    // Al pasar a 'hm', si tenía minutos > 60 los
                    // distribuimos en h + min para mantener el valor.
                    if (tiempoMode !== 'hm') {
                      const m = parseInt(tiempoMinutos, 10) || 0;
                      setTiempoHoras(m >= 60 ? String(Math.floor(m / 60)) : '');
                      setTiempoMinutos(m >= 60 ? String(m % 60) : tiempoMinutos);
                      setTiempoMode('hm');
                    }
                  })}
                  aria-pressed={tiempoMode === 'hm'}
                >
                  HORAS + MINUTOS
                </button>
                <button
                  type="button"
                  className={
                    'dia-editor-tiempo-tab'
                    + (tiempoMode === 'min'
                      ? ' dia-editor-tiempo-tab--active'
                      : '')
                  }
                  onClick={blurAndRun(() => {
                    // Al volver a 'min', si tenía horas las convertimos
                    // a minutos totales para no perder el dato.
                    if (tiempoMode !== 'min') {
                      const h = parseInt(tiempoHoras, 10) || 0;
                      const m = parseInt(tiempoMinutos, 10) || 0;
                      const total = h * 60 + m;
                      setTiempoMinutos(total > 0 ? String(total) : '');
                      setTiempoHoras('');
                      setTiempoMode('min');
                    }
                  })}
                  aria-pressed={tiempoMode === 'min'}
                >
                  SOLO MINUTOS
                </button>
              </div>
              <div className="dia-editor-tiempo-inputs">
                {tiempoMode === 'hm' && (
                  <div className="dia-editor-tiempo-field">
                    <input
                      className="sup-input dia-editor-tiempo-num"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={23}
                      step={1}
                      maxLength={2}
                      placeholder="0"
                      value={tiempoHoras}
                      onChange={(e) => setTiempoHoras(e.target.value)}
                      aria-label="Horas"
                    />
                    <span className="dia-editor-tiempo-unit">h</span>
                  </div>
                )}
                <div className="dia-editor-tiempo-field">
                  <input
                    className="sup-input dia-editor-tiempo-num"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={tiempoMode === 'hm' ? 59 : 999}
                    step={1}
                    maxLength={3}
                    placeholder="0"
                    value={tiempoMinutos}
                    onChange={(e) => setTiempoMinutos(e.target.value)}
                    aria-label="Minutos"
                  />
                  <span className="dia-editor-tiempo-unit">m</span>
                </div>
              </div>
            </div>

            {/* 3 slots de badges · primario obligatorio para que se renderice */}
            {/* Tipos del día (1-3 slots) · réplica del v1: tipo 2
                oculto si no hay tipo 1, tipo 3 oculto si no hay tipo 2.
                Cuando el user limpia un slot, los siguientes se
                vacían en cascada. Internamente el schema los llama
                "badge" pero en UI usamos "tipo" porque es más
                comprensible (es el grupo muscular o tipo de entreno
                del día: Pecho, Fuerza, Empuje, Hipertrofia, etc.). */}
            <BadgeSlot
              label={
                <>
                  Tipo principal
                  <span className="dia-editor-required">*</span>
                </>
              }
              badge={local.badge}
              badgeCustom={local.badgeCustom}
              onChangeBadge={(b) => {
                update('badge', b);
                // Si quita el principal, limpia los siguientes.
                if (!b) {
                  update('badge2', '');
                  update('badgeCustom2', '');
                  update('badge3', '');
                  update('badgeCustom3', '');
                }
              }}
              onChangeCustom={(c) => update('badgeCustom', c)}
            />
            {local.badge && (
              <BadgeSlot
                label={
                  <>
                    Tipo 2{' '}
                    <span className="dia-editor-optional-tag">(OPCIONAL)</span>
                  </>
                }
                badge={local.badge2}
                badgeCustom={local.badgeCustom2}
                onChangeBadge={(b) => {
                  update('badge2', b);
                  if (!b) {
                    update('badge3', '');
                    update('badgeCustom3', '');
                  }
                }}
                onChangeCustom={(c) => update('badgeCustom2', c)}
              />
            )}
            {local.badge && local.badge2 && (
              <BadgeSlot
                label={
                  <>
                    Tipo 3{' '}
                    <span className="dia-editor-optional-tag">(OPCIONAL)</span>
                  </>
                }
                badge={local.badge3}
                badgeCustom={local.badgeCustom3}
                onChangeBadge={(b) => update('badge3', b)}
                onChangeCustom={(c) => update('badgeCustom3', c)}
              />
            )}

            {/* Lista de ejercicios */}
            <div className="dia-editor-section-head">
              <h3>
                Ejercicios
                <span className="dia-editor-required">*</span>{' '}
                <span className="dia-editor-optional-tag">
                  (SELECCIONAR MÍNIMO 1)
                </span>
              </h3>
              <span className="dia-editor-count">
                {local.ejercicios.length}{' '}
                {local.ejercicios.length === 1
                  ? 'ejercicio seleccionado'
                  : 'ejercicios seleccionados'}
              </span>
            </div>

            {local.ejercicios.length === 0 && (
              <p className="dia-editor-empty">
                Aún no hay ejercicios. Pulsa "+" para añadir el primero.
              </p>
            )}

            {local.ejercicios.map((ej, i) => (
              <EjercicioRow
                key={i}
                idx={i}
                ej={ej}
                groups={suggestedGroups}
                onChange={(partial) => updateEjercicio(i, partial)}
                onRemove={() => requestRemoveEjercicio(i)}
              />
            ))}

            <button
              type="button"
              className="dia-editor-add-btn"
              onClick={blurAndRun(addEjercicio)}
            >
              <MealIcon value="tb:plus" size={18} />
              Añadir ejercicio
            </button>

            {/* (Sin comentario al final del día · las notas viven en
                cada ejercicio, debajo de su bloque Series×Reps.) */}

            {/* Indicador de estado del guardado · "Guardando…" /
                "Guardado" / "Error". Visible justo encima de los
                botones · réplica del patrón de MealEditor. */}
            <div className="save-indicator-wrap">
              <SaveIndicator status={status} />
            </div>

            {/* Acciones · Cancelar / Guardar */}
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
                disabled={submitting}
              >
                Guardar día
              </IonButton>
            </div>

            {/* Botón eliminar día · solo visible si el caller
                proporciona onDelete (ej. EntrenoPage solo lo pasa
                cuando el plan tiene >1 día · evita dejar planes vacíos).
                Réplica del v1 (peDelDay con mobileConfirm). */}
            {onDelete && (
              <>
                <div className="sup-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="sup-day-btn sup-day-btn--remove"
                  onClick={blurAndRun(() => setConfirmDeleteDia(true))}
                  disabled={submitting}
                >
                  <MealIcon value="tb:trash" size={18} />
                  Eliminar día
                </button>
              </>
            )}
          </div>
        </div>
      </IonContent>

      {/* Alert "Faltan campos obligatorios" · réplica del v1
          (savePlanModal). Solo el título es obligatorio · resto opcional. */}
      <IonAlert
        isOpen={missingAlert !== null}
        onDidDismiss={() => setMissingAlert(null)}
        header="Faltan campos obligatorios"
        message={
          missingAlert
            ? `Para guardar el día necesitas rellenar:\n\n${missingAlert
                .map((m) => `• ${m}`)
                .join('\n')}`
            : ''
        }
        buttons={[{ text: 'Entendido', role: 'cancel' }]}
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

      {/* Confirmación borrar ejercicio · réplica v1 peDelEx */}
      <IonAlert
        isOpen={confirmDeleteEj !== null}
        onDidDismiss={() => setConfirmDeleteEj(null)}
        header="¿Eliminar ejercicio?"
        message={
          confirmDeleteEj !== null
            ? `Se eliminará "${
                local.ejercicios[confirmDeleteEj]?.nombre.trim()
                || `ejercicio ${confirmDeleteEj + 1}`
              }" del día.`
            : ''
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              confirmRemoveEjercicio();
            },
          },
        ]}
      />

      {/* Confirmación borrar día completo · réplica v1 peDelDay.
          Solo se renderiza si el caller pasó onDelete. */}
      {onDelete && (
        <IonAlert
          isOpen={confirmDeleteDia}
          onDidDismiss={() => setConfirmDeleteDia(false)}
          header="¿Eliminar día?"
          message={`Se eliminará "${
            local.titulo.trim() || `Día ${diaIdx + 1}`
          }" y todos sus ejercicios.`}
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Eliminar',
              role: 'destructive',
              handler: () => {
                setConfirmDeleteDia(false);
                Promise.resolve(onDelete()).catch((err) =>
                  console.error('[BTal] onDelete dia error:', err),
                );
              },
            },
          ]}
        />
      )}

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Día guardado"
        duration={1800}
        position="bottom"
        color="success"
      />
    </IonModal>
  );
}

// ── Sub-componente · selector de un slot de badge ────────────────────
interface BadgeSlotProps {
  label: ReactNode;
  badge: EjercicioBadge | '';
  badgeCustom: string;
  onChangeBadge: (b: EjercicioBadge | '') => void;
  onChangeCustom: (c: string) => void;
}

function BadgeSlot({
  label,
  badge,
  badgeCustom,
  onChangeBadge,
  onChangeCustom,
}: BadgeSlotProps) {
  return (
    <div className="sup-form-group dia-editor-badge-slot">
      <label className="sup-label">{label}</label>
      <select
        className="sup-input dia-editor-select"
        value={badge}
        onChange={(e) =>
          onChangeBadge((e.target.value || '') as EjercicioBadge | '')
        }
      >
        <option value="">— Ninguno —</option>
        {BADGE_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt} value={opt}>
                {BADGE_BY_VAL[opt]?.label ?? opt}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {badge === 'custom' && (
        <input
          className="sup-input dia-editor-badge-custom"
          type="text"
          maxLength={BADGE_CUSTOM_MAX}
          placeholder="Nombre del tipo"
          value={badgeCustom}
          onChange={(e) => onChangeCustom(e.target.value)}
        />
      )}
    </div>
  );
}

// ── Sub-componente · fila editable de un ejercicio ─────────────────
//
// Combina nombre + notas + editor estructurado de series:
//   - Series (1..100)  ×  Reps (1..300)  [□ Rango]
//   - Si Rango ✓ aparece un select extra "Hasta" (Reps2 > Reps1).
//   - Para series no-numéricas ("30 min", "AMRAP"), un toggle "Texto
//     libre" cae al input de texto del v1 sin perder el valor.
//
// El estado interno (s, r1, r2, rango) deriva de `ej.series` con
// parseSeries · al cambiar cualquiera, recompongo con formatSeries y
// emito el cambio vía onChange. Texto libre se guarda tal cual.
interface EjercicioRowProps {
  idx: number;
  ej: Ejercicio;
  // Grupos de ejercicios sugeridos según los badges del día · cada uno
  // se renderiza como un <optgroup> con su label (PECHO, ESPALDA…)
  // estilizado en amarillo.
  groups: { label: string; exercises: string[] }[];
  onChange: (partial: Partial<Ejercicio>) => void;
  onRemove: () => void;
}

function EjercicioRow({
  idx,
  ej,
  groups,
  onChange,
  onRemove,
}: EjercicioRowProps) {
  // Detecta si el valor actual no parsea como N×M · empezamos en modo
  // "texto libre" para que el user no pierda el dato (ej. "30 min").
  const startsFreeMode = isFreeFormatSeries(ej.series);
  const [freeMode, setFreeMode] = useState(startsFreeMode);

  // ¿El nombre actual está en alguna categoría sugerida? Si no, lo
  // tratamos como custom · réplica del v1 (`isCustom` en
  // peExerciseSelectHTML).
  const allCatalogued = Object.values(EXERCISES_BY_TYPE).flat();
  const isInCatalog =
    ej.nombre.length > 0 && allCatalogued.includes(ej.nombre);
  const isCustomEx = ej.nombre.length > 0 && !isInCatalog;

  // Modo custom explícito: cuando el user elige "✏ Personalizado…" en
  // el dropdown · réplica del v1 (`peExSelectChanged` toggles display
  // del .pe-ex-custom). Lo guardamos en estado local porque al picar
  // "Personalizado…" el nombre puede quedar vacío y entonces no
  // podríamos recuperar el modo custom solo desde `ej.nombre`.
  const [customMode, setCustomMode] = useState(isCustomEx);

  const showCustomInput = customMode || isCustomEx;
  const selectValue = showCustomInput
    ? CUSTOM_EXERCISE_SENTINEL
    : ej.nombre;

  const handleSelectChange = (val: string) => {
    if (val === CUSTOM_EXERCISE_SENTINEL) {
      // Activa modo custom · borramos el nombre actual para que el
      // input aparezca vacío (UX más clara: el user pulsó "voy a
      // escribir uno mío" y empieza desde cero, no con el último
      // ejercicio del catálogo aún ahí).
      setCustomMode(true);
      onChange({ nombre: '' });
    } else {
      // Volvemos al catálogo · desactivamos custom y aplicamos el
      // ejercicio elegido. v1 también clear-ea el input custom aquí.
      setCustomMode(false);
      onChange({ nombre: val });
    }
  };

  const parsed = parseSeries(ej.series);
  const hasRango = !!parsed.r2;

  // Helper · re-emite las series serializadas a partir de los 3 valores.
  const emitStructured = (s: string, r1: string, r2: string) => {
    onChange({ series: formatSeries(s, r1, r2) });
  };

  const setSeries = (s: string) => emitStructured(s, parsed.r1, parsed.r2);
  const setReps1 = (r1: string) => {
    // Si rango activo y el nuevo r1 >= r2, ajusta r2 = r1+1 (cap 300).
    if (hasRango && r1 && parsed.r2 && parseInt(r1, 10) >= parseInt(parsed.r2, 10)) {
      const newR2 = String(Math.min(300, parseInt(r1, 10) + 1));
      emitStructured(parsed.s, r1, newR2);
      return;
    }
    emitStructured(parsed.s, r1, parsed.r2);
  };
  const setReps2 = (r2: string) => emitStructured(parsed.s, parsed.r1, r2);

  const toggleRango = (checked: boolean) => {
    if (checked) {
      // Activar rango · si no hay r2, autorelleno con r1+1 (cap 300).
      const r1Num = parseInt(parsed.r1, 10);
      const newR2 =
        parsed.r1 && !parsed.r2 ? String(Math.min(300, r1Num + 1)) : parsed.r2;
      emitStructured(parsed.s, parsed.r1, newR2);
    } else {
      // Desactivar · borra r2.
      emitStructured(parsed.s, parsed.r1, '');
    }
  };

  const toggleFreeMode = () => {
    setFreeMode((cur) => !cur);
  };

  return (
    <div className="dia-editor-ej-row">
      {/* Número del ejercicio · esquina superior derecha · informativo,
          no quita espacio horizontal al resto de inputs. */}
      <div className="dia-editor-ej-num">#{idx + 1}</div>
      <div className="dia-editor-ej-fields">
        {/* Selector de ejercicio · réplica del v1 (peExerciseSelectHTML).
            Las opciones se agrupan por badge del día (máx 3 grupos),
            con los labels en amarillo + uppercase para distinguir
            categorías. Última opción "✏ Personalizado…" que toggle un
            input de texto libre debajo. */}
        <select
          className="sup-input dia-editor-ej-select"
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          aria-label="Seleccionar ejercicio"
        >
          <option value="">— Selecciona un ejercicio —</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Otro">
            <option value={CUSTOM_EXERCISE_SENTINEL}>
              ✏ Personalizado…
            </option>
          </optgroup>
        </select>

        {/* Input de ejercicio personalizado · visible si:
              - el user pulsó "✏ Personalizado…" en el select (customMode)
              - el valor actual no está en ningún catálogo (isCustomEx)
            Réplica del v1 .pe-ex-custom (display block/none según
            peExSelectChanged). El input está bound al mismo `nombre`
            del schema · al guardar, se persiste tal cual.
            Nota · al pulsar "Personalizado…" el campo se limpia (no
            preserva el último ejercicio del catálogo) · UX explícita
            "estoy escribiendo uno mío desde cero". */}
        {showCustomInput && (
          <input
            className="sup-input dia-editor-ej-input dia-editor-ej-custom"
            type="text"
            maxLength={EJ_NOMBRE_MAX}
            placeholder="Escribe el nombre del ejercicio"
            value={ej.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            autoFocus={customMode && !isCustomEx}
          />
        )}


        {/* Editor de series: estructurado por defecto, fallback a texto
            libre para formatos no numéricos ("30 min", "AMRAP", etc.). */}
        {freeMode ? (
          <div className="dia-editor-series-block">
            <input
              className="sup-input dia-editor-ej-input dia-editor-ej-series"
              type="text"
              maxLength={EJ_SERIES_MAX}
              placeholder="ej. 30 min"
              value={ej.series}
              onChange={(e) => onChange({ series: e.target.value })}
            />
            <button
              type="button"
              className="dia-editor-mode-toggle"
              onClick={blurAndRun(toggleFreeMode)}
              title="Volver a selectores Series × Reps"
            >
              S×R
            </button>
          </div>
        ) : (
          <div className="dia-editor-series-block">
            <div className="dia-editor-series-group">
              <label className="dia-editor-series-lbl">Series</label>
              <select
                className="dia-editor-series-select"
                value={parsed.s}
                onChange={(e) => setSeries(e.target.value)}
                aria-label="Número de series"
              >
                <option value="">—</option>
                {SERIES_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <span className="dia-editor-series-sep">×</span>
            <div className="dia-editor-series-group">
              <label className="dia-editor-series-lbl">Reps</label>
              <select
                className="dia-editor-series-select"
                value={parsed.r1}
                onChange={(e) => setReps1(e.target.value)}
                aria-label="Reps mínimas"
              >
                <option value="">—</option>
                {REPS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            {hasRango && (
              <>
                <span className="dia-editor-series-sep">–</span>
                <div className="dia-editor-series-group">
                  <label className="dia-editor-series-lbl">Hasta</label>
                  <select
                    className="dia-editor-series-select"
                    value={parsed.r2}
                    onChange={(e) => setReps2(e.target.value)}
                    aria-label="Reps máximas"
                  >
                    <option value="">—</option>
                    {REPS_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <label className="dia-editor-series-rango">
              <input
                type="checkbox"
                checked={hasRango}
                onChange={(e) => toggleRango(e.target.checked)}
              />
              Rango
            </label>
            <button
              type="button"
              className="dia-editor-mode-toggle dia-editor-mode-toggle--icon"
              onClick={blurAndRun(toggleFreeMode)}
              title='Cambiar a texto libre (ej. "30 min")'
              aria-label='Cambiar a texto libre'
            >
              <MealIcon value="tb:pencil" size={16} />
            </button>
          </div>
        )}

        {/* Fila final · notas (flex 1) + botón eliminar a la derecha.
            La papelera queda fija 36×36 y las notas ocupan el resto
            del ancho · ambos al mismo nivel vertical. */}
        <div className="dia-editor-ej-bottom-row">
          <input
            className="sup-input dia-editor-ej-input dia-editor-ej-input--small dia-editor-ej-notas"
            type="text"
            maxLength={EJ_DESC_MAX}
            placeholder="Notas (opcional)"
            value={ej.desc}
            onChange={(e) => onChange({ desc: e.target.value })}
          />
          <button
            type="button"
            className="dia-editor-ej-del"
            onClick={blurAndRun(onRemove)}
            aria-label={`Quitar ejercicio ${idx + 1}`}
          >
            <MealIcon value="tb:trash" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
