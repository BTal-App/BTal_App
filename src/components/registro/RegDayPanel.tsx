import { useEffect, useMemo, useState } from 'react';
import { IonAlert } from '@ionic/react';
import { MealIcon } from '../MealIcon';
import {
  ConfirmDiffAlert,
  type PendingConfirm,
} from '../ConfirmDiffAlert';
import {
  maxKgEjercicio,
  normalizeExerciseName,
  type EjercicioRegistrado,
  type Entrenos,
  type ExerciseHistoryEntry,
  type PRStat,
  type RegistroDia,
  type SerieRegistrada,
} from '../../templates/defaultUser';
import {
  enumeratePlanOptions,
  formatFechaCorta,
  getRegPlanDay,
  regSeriesCount,
} from '../../utils/registro';
import { dayKeyFromFecha } from '../../utils/dateKeys';
import { diffRegistroDia } from '../../utils/registroDiff';
import { blurAndRun } from '../../utils/focus';

// Panel del día seleccionado · réplica del `reg-panel` del v1. Muestra:
//   - Selector "Plan del día" con todas las opciones de entrenos.planes
//     + 'DESCANSO'.
//   - Para entreno: lista de ejercicios del plan con inputs kg/reps por
//     serie + sparkline SVG con el historial reciente y delta vs anterior.
//   - Para descanso: mensaje azul con icono cama "Día de descanso.
//     Pulsa Guardar registro para marcarlo".
//   - Notas libres (max 500).
//   - Botones "✓ Guardar" y "🗑 Eliminar registro" cuando hay plan
//     seleccionado.

export interface RegDayPanelProps {
  fecha: string;
  registro: RegistroDia | null;
  entrenos: Entrenos | undefined | null;
  recommendedPlanId: string | null;
  exerciseHistory: Record<string, ExerciseHistoryEntry[]>;
  prs: Record<string, PRStat>;
  onSave: (next: RegistroDia) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const NOTES_MAX = 500;

// SVG inline sparkline · acepta un array de entries y dibuja una
// polilínea normalizada al rango min/max de kg. Min 2 puntos · si hay
// menos no renderizamos nada (el caller decide).
function Sparkline({
  history,
  color = 'var(--btal-lime)',
}: {
  history: ExerciseHistoryEntry[];
  color?: string;
}) {
  if (history.length < 2) return null;
  const W = 100;
  const H = 28;
  const P = 3;
  const maxKg = Math.max(...history.map((h) => h.maxKg));
  const minKg = Math.min(...history.map((h) => h.maxKg));
  const range = maxKg - minKg || 1;
  const points = history.map((h, i) => {
    const x = P + ((W - 2 * P) * i) / (history.length - 1);
    const y = P + ((H - 2 * P) * (1 - (h.maxKg - minKg) / range));
    return [x, y] as const;
  });
  const polyline = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="reg-sparkline" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={color} />
      ))}
    </svg>
  );
}

export function RegDayPanel({
  fecha,
  registro,
  entrenos,
  recommendedPlanId,
  exerciseHistory,
  prs,
  onSave,
  onDelete,
  onClose,
}: RegDayPanelProps) {
  // ── State ────────────────────────────────────────────────────────────
  const [planValue, setPlanValue] = useState<string>(registro?.plan ?? '');
  // Map ejercicio → registro. Se recomputa al cambiar plan (preservando
  // las series ya rellenadas para los ejercicios que existían en el
  // plan anterior con el mismo nombre).
  const [exercises, setExercises] = useState<Record<string, EjercicioRegistrado>>(
    registro?.exercises ?? {},
  );
  // Ejercicios que el user eliminó del registro de este día · no se
  // re-añaden al cambiar de día dentro del mismo plan. Se reinicia al
  // cambiar de plan.
  const [removedExercises, setRemovedExercises] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string>(registro?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Alerts
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveEx, setConfirmRemoveEx] = useState<string | null>(null);
  // "Eliminar series" v1-style · checkboxes por serie con sus kg para
  // que el user identifique cuáles eliminar (réplica del v1
  // `regOpenDeleteSeries`). El state guarda la lista de series tal
  // cual están en pantalla en el momento de abrir el alert.
  const [deleteSeriesAlert, setDeleteSeriesAlert] = useState<{
    exName: string;
    sets: SerieRegistrada[];
  } | null>(null);
  // Tooltip info del ejercicio · al pulsar el botón ⓘ se abre un
  // IonAlert con el texto explicativo (en móvil el `title=""` HTML no
  // se muestra; replicamos el `regToggleInfoTip` del v1 con un alert
  // explícito que sí funciona en touch).
  const [infoExName, setInfoExName] = useState<string | null>(null);
  const [infoExSeries, setInfoExSeries] = useState<string | null>(null);
  // Confirm de "¿Descartar cambios?" al cerrar el panel con form
  // dirty (kg/notas modificados sin haber guardado).
  const [discardConfirm, setDiscardConfirm] = useState(false);
  // Save flow · al pulsar "Guardar" calculamos el diff vs `registro`
  // (lo persistido) y lo mostramos en `ConfirmDiffAlert` antes de
  // ejecutar el `onSave`. Mismo patrón que PlanEditorModal/DiaEditorModal
  // (utils/entrenoDiff.ts + ConfirmDiffAlert).
  const [pendingSave, setPendingSave] =
    useState<PendingConfirm<RegistroDia> | null>(null);

  // ── Reset state cuando cambia la fecha ────────────────────────────────
  // Sync intencional · cuando el padre cambia `fecha` (otro día del
  // calendar) o pasa un `registro` recién persistido, repoblamos el
  // formulario. Una alternativa más idiomática React 19 sería montar
  // el componente con `key={fecha}` en el padre · queda como mejora.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setPlanValue(registro?.plan ?? '');
    setExercises(registro?.exercises ?? {});
    setRemovedExercises(new Set());
    setNotes(registro?.notes ?? '');
    setErrorMsg(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fecha, registro]);

  // ── Plan-day info derivada ────────────────────────────────────────────
  const planInfo = useMemo(
    () => getRegPlanDay(planValue, entrenos),
    [planValue, entrenos],
  );

  // ── Re-compute exercises map al cambiar plan ─────────────────────────
  // Si el plan es 'rest' o vacío, exercises queda vacío (el guardado
  // ignora el bloque). Si es entreno, hidratamos cada ejercicio del
  // día con N series vacías (`regSeriesCount`) preservando lo que el
  // user ya hubiera rellenado previamente para ese mismo nombre.
  useEffect(() => {
    if (!planInfo) {
      // 'rest' o vacío · no recomputamos exercises (la UI los oculta).
      return;
    }
    // Sync intencional · plan changes recompute exercises preserving
    // user-entered kg/reps. React 19 idiomatic sería un map de
    // overrides keyed por (exName, setIdx) y derivar todo en render ·
    // queda como mejora futura.
    /* eslint-disable react-hooks/set-state-in-effect */
    setExercises((prev) => {
      const next: Record<string, EjercicioRegistrado> = {};
      for (let i = 0; i < planInfo.day.ejercicios.length; i++) {
        const ej = planInfo.day.ejercicios[i];
        if (removedExercises.has(ej.nombre)) continue;
        const sCount = regSeriesCount(ej.series);
        const existing = prev[ej.nombre];
        if (existing && Array.isArray(existing.sets)) {
          // Preservar lo que ya tenía · si tiene más series que las
          // que pide el plan, mantenemos las del user (manual override).
          // Si tiene menos, completamos con vacíos.
          const sets: SerieRegistrada[] = [...existing.sets];
          while (sets.length < sCount) sets.push({ kg: '', reps: '' });
          next[ej.nombre] = { sets };
        } else {
          next[ej.nombre] = {
            sets: Array.from({ length: sCount }, () => ({ kg: '', reps: '' })),
          };
        }
      }
      return next;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [planInfo, removedExercises]);

  // ── Plan options para el select ──────────────────────────────────────
  // Filtramos por el día de la semana de la fecha seleccionada · solo
  // aparecen los días de cada plan asignados a ese día (ej. al elegir
  // un martes, solo se muestran los días de plan con `diaSemana==='mar'`).
  // Agrupados en dos categorías: predeterminados (builtIn 1-7) y
  // personalizados (custom). DESCANSO se renderiza aparte siempre.
  const selectedDayKey = useMemo(() => dayKeyFromFecha(fecha), [fecha]);
  const planOptions = useMemo(
    () => enumeratePlanOptions(entrenos, recommendedPlanId, selectedDayKey),
    [entrenos, recommendedPlanId, selectedDayKey],
  );

  // ── Detección de cambios sin guardar ────────────────────────────────
  // Compara el state actual del form con el `registro` persistido (lo
  // que hay en Firestore). Si difiere, isDirty=true y `handleClose`
  // intercepta el cierre con un IonAlert.
  //
  // Para `exercises` hacemos comparación deep vía JSON.stringify · es
  // caro pero el objeto es pequeño (≤ 8 ejercicios × 5 series). Más
  // simple que dependency walk profundo y el resultado se memoriza.
  const isDirty = useMemo(() => {
    if (!registro) {
      // Sin registro previo · dirty si user ha tocado plan o notas.
      return planValue !== '' || notes !== '';
    }
    if ((registro.plan ?? '') !== planValue) return true;
    if ((registro.notes ?? '') !== notes) return true;
    if (registro.plan === 'rest' || planValue === 'rest') return false;
    try {
      return JSON.stringify(registro.exercises ?? {}) !== JSON.stringify(exercises);
    } catch {
      return false;
    }
  }, [registro, planValue, notes, exercises]);

  // ── Handlers ─────────────────────────────────────────────────────────
  function handlePlanChange(value: string) {
    setPlanValue(value);
    // Al cambiar de plan, reset de los ejercicios eliminados (es otro
    // plan/día · sus exclusiones no aplican).
    setRemovedExercises(new Set());
    if (value === 'rest' || value === '') {
      setExercises({});
    }
  }

  function handleSetChange(
    exName: string,
    setIdx: number,
    field: 'kg' | 'reps',
    value: string,
  ) {
    setExercises((prev) => {
      const ej = prev[exName];
      if (!ej) return prev;
      const sets = ej.sets.map((s, i) =>
        i === setIdx ? { ...s, [field]: value } : s,
      );
      return { ...prev, [exName]: { sets } };
    });
  }

  function handleRemoveExercise(exName: string) {
    setExercises((prev) => {
      const next = { ...prev };
      delete next[exName];
      return next;
    });
    setRemovedExercises((prev) => {
      const next = new Set(prev);
      next.add(exName);
      return next;
    });
    setConfirmRemoveEx(null);
  }

  // Réplica del v1 `regOpenDeleteSeries` · recibe los índices que el
  // user marcó en el alert (checkbox handler los pasa como array) y
  // los elimina del array de series en orden inverso para que los
  // índices no se desplacen durante el splice.
  function handleApplyDeleteSeries(exName: string, indicesToDelete: number[]) {
    setDeleteSeriesAlert(null);
    if (!indicesToDelete?.length) return;
    setExercises((prev) => {
      const ej = prev[exName];
      if (!ej) return prev;
      const newSets = [...ej.sets];
      const sorted = [...indicesToDelete].sort((a, b) => b - a);
      for (const i of sorted) {
        if (i >= 0 && i < newSets.length) newSets.splice(i, 1);
      }
      return { ...prev, [exName]: { sets: newSets } };
    });
  }

  // Construye el `RegistroDia` a partir del state actual del form.
  // El `now` se pasa como argumento (no llamamos `Date.now()` aquí)
  // para que esta función sea pura · el linter lo exige y nos
  // permite testearla determinísticamente en futuro.
  function buildNextRegistro(now: number): RegistroDia {
    return {
      fecha,
      plan: planValue,
      exercises: planValue === 'rest' ? {} : exercises,
      notes: notes.slice(0, NOTES_MAX),
      updatedAt: now,
    };
  }

  // "Guardar" · construye el next, calcula el diff vs `registro` (lo
  // persistido) y abre el `ConfirmDiffAlert`. Si no hay cambios el
  // propio modal lo indica con "Sin cambios detectados".
  function handleRequestSave() {
    if (!planValue) {
      setErrorMsg('Selecciona un plan o "Descanso" antes de guardar.');
      return;
    }
    setErrorMsg(null);
    // `Date.now()` es impuro pero esto es un event handler · el
    // linter no distingue render de handler, así que silenciamos.
    // eslint-disable-next-line react-hooks/purity
    const next = buildNextRegistro(Date.now());
    const changes = diffRegistroDia(registro, next, entrenos);
    setPendingSave({ changes, cleaned: next });
  }

  // Confirmación del modal · ejecuta el save real. Tras éxito, el
  // `onSave` del padre refresca byDate (onSnapshot) y stats; nuestro
  // useEffect [fecha, registro] resincroniza el form con los datos
  // recién persistidos (kg/reps que el user escribió siguen en pantalla).
  async function handleConfirmSave() {
    if (!pendingSave) return;
    const cleaned = pendingSave.cleaned;
    setPendingSave(null);
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(cleaned);
    } catch (err) {
      console.warn('[RegDayPanel] save failed', err);
      setErrorMsg('No se pudo guardar el registro. Reintenta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setSaving(true);
    setErrorMsg(null);
    try {
      await onDelete();
    } catch (err) {
      console.warn('[RegDayPanel] delete failed', err);
      setErrorMsg('No se pudo eliminar el registro. Reintenta.');
    } finally {
      setSaving(false);
    }
  }

  // Cierre del panel · si hay cambios sin guardar, abrimos confirm.
  // Si confirma "Descartar", llamamos a onClose. Si cancela, el panel
  // queda abierto con su state intacto.
  function handleRequestClose() {
    if (isDirty) {
      setDiscardConfirm(true);
      return;
    }
    onClose();
  }

  // ── Render ───────────────────────────────────────────────────────────
  const isRest = planValue === 'rest';
  const exerciseEntries = planInfo
    ? planInfo.day.ejercicios.filter((ej) => !removedExercises.has(ej.nombre))
    : [];

  // Si no se ha empezado nada (sin registro previo y sin plan elegido)
  // mostramos un placeholder más amable. Igualmente el select aparece.
  const isVacio = !registro && !planValue;

  return (
    <div className="reg-day-panel btal-anim-fade-up">
      <div className="reg-day-panel-head">
        <h2 className="reg-day-panel-title">{formatFechaCorta(fecha)}</h2>
        {/* X de cerrar · circular gris sutil · mismo look que las X de
            los modales (`.settings-modal-close`). Antes era un botón
            rojo "Cerrar" con texto · sustituido por un X icono solo
            para coherencia con el resto de la app. */}
        <button
          type="button"
          className="reg-day-panel-close"
          onClick={handleRequestClose}
          aria-label="Cerrar panel del día"
        >
          <MealIcon value="tb:x" size={20} />
        </button>
      </div>

      <div className="reg-day-panel-field">
        <label className="reg-day-panel-label" htmlFor={`reg-plan-${fecha}`}>
          Plan del día
        </label>
        <select
          id={`reg-plan-${fecha}`}
          className="reg-day-panel-select"
          value={planValue}
          onChange={(e) => handlePlanChange(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {/*
            Selector agrupado por categorías · solo aparecen los días
            de plan que coincidan con el día de semana de `fecha`.
            DESCANSO siempre disponible al final (el user puede marcar
            descanso cualquier día). Si no hay planes para ese día, los
            optgroup quedan vacíos y solo se ofrece DESCANSO.
          */}
          {/*
            Plan recomendado prefijado con "estrella + espacio".
            El label queda ligeramente desplazado a la derecha
            respecto al resto (el char ocupa espacio en el flujo
            de texto del option) pero la estrella sirve como
            marker visual obvio. Resto de planes y DESCANSO sin
            prefijo: alineados en X=0 del option.
          */}
          {planOptions.predeterminados.length > 0 && (
            <optgroup label="PLANES POR DEFECTO">
              {planOptions.predeterminados.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {(opt.isRecommended ? '★ ' : '') + opt.label}
                </option>
              ))}
            </optgroup>
          )}
          {planOptions.personalizados.length > 0 && (
            <optgroup label="PLANES CREADOS">
              {planOptions.personalizados.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {(opt.isRecommended ? '★ ' : '') + opt.label}
                </option>
              ))}
            </optgroup>
          )}
          {/* DESCANSO · siempre disponible, independientemente del
              día seleccionado en el calendar. El user puede marcar
              cualquier día como descanso · es la opción de fallback
              universal. */}
          <optgroup label="OTROS">
            <option value={planOptions.rest.value}>
              {planOptions.rest.label}
            </option>
          </optgroup>
        </select>
      </div>

      {isVacio && (
        <p className="reg-day-panel-empty">
          Selecciona el plan que has hecho hoy o marca "Descanso".
        </p>
      )}

      {isRest && (
        <div className="reg-day-panel-rest">
          <MealIcon value="tb:bed" size={18} className="reg-day-panel-rest-icon" />
          Día de descanso. Pulsa <strong>Guardar registro</strong> para
          marcarlo en el calendario.
        </div>
      )}

      {planInfo && (
        <div className="reg-day-panel-exercises">
          <div className="reg-day-panel-exercises-head">
            <span className="reg-day-panel-label">Registro de pesos</span>
            <span className="reg-day-panel-day-meta">
              {planInfo.day.titulo}
            </span>
          </div>
          {exerciseEntries.length === 0 && (
            <p className="reg-day-panel-empty">
              Has eliminado todos los ejercicios. Cambia de plan para
              recuperarlos o marca como "Descanso".
            </p>
          )}
          {exerciseEntries.map((ej, exIdx) => {
            const exNorm = normalizeExerciseName(ej.nombre);
            const history = exerciseHistory[exNorm] ?? [];
            const pr = prs[exNorm];
            const cur = exercises[ej.nombre];
            const sets = cur?.sets ?? [];
            const todayMax = cur ? maxKgEjercicio(cur) : 0;
            const isPRToday = pr && todayMax > 0 && todayMax >= pr.kg;
            const delta =
              history.length >= 2
                ? history[history.length - 1].maxKg
                  - history[history.length - 2].maxKg
                : 0;
            const deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
            // Stagger limitado a los primeros 8 ejercicios · si hay
            // más (raro pero posible en planes custom), los siguientes
            // entran sin delay para no acumular más de 320 ms de lag.
            const staggerCls = exIdx < 8 ? `btal-stagger-${exIdx + 1}` : '';
            return (
              <div
                key={ej.nombre}
                className={`reg-ex-row btal-anim-fade-up ${staggerCls}`}
              >
                <div className="reg-ex-head">
                  <span className="reg-ex-name">
                    {ej.nombre.toUpperCase()}
                    {isPRToday && (
                      <span className="reg-ex-pr-badge" title="Personal Record">
                        <MealIcon value="tb:star" size={12} /> PR
                      </span>
                    )}
                  </span>
                  <div className="reg-ex-actions">
                    <button
                      type="button"
                      className="reg-ex-action reg-ex-action-info"
                      onClick={() => {
                        setInfoExName(ej.nombre);
                        setInfoExSeries(ej.series);
                      }}
                      aria-label="Información del ejercicio"
                    >
                      <MealIcon value="tb:info-circle" size={16} />
                    </button>
                    <button
                      type="button"
                      className="reg-ex-action reg-ex-action-warn"
                      onClick={() => {
                        // Pasamos las series ACTUALES (con kg/reps que
                        // el user haya escrito) para que el alert muestre
                        // "Serie 1 · 80 kg", "Serie 2 · 85 kg", etc.
                        const cur = exercises[ej.nombre];
                        setDeleteSeriesAlert({
                          exName: ej.nombre,
                          sets: cur?.sets ?? [],
                        });
                      }}
                      aria-label="Eliminar series"
                    >
                      <MealIcon value="tb:trash" size={14} />
                      <span>Series</span>
                    </button>
                    <button
                      type="button"
                      className="reg-ex-action reg-ex-action-danger"
                      onClick={() => setConfirmRemoveEx(ej.nombre)}
                      aria-label="Eliminar ejercicio del registro"
                    >
                      <MealIcon value="tb:trash" size={14} />
                      <span>Ejercicio</span>
                    </button>
                  </div>
                </div>
                <div className="reg-ex-series">{ej.series}</div>
                {history.length >= 2 && (
                  <div className="reg-ex-history">
                    <Sparkline history={history} />
                    <div className="reg-ex-history-meta">
                      <span className="reg-ex-history-sessions">
                        <MealIcon
                          value="tb:trending-up"
                          size={12}
                          className="reg-ex-history-sessions-icon"
                        />
                        {history.length} sesiones
                      </span>
                      {delta !== 0 && (
                        <span className={`reg-ex-history-delta ${deltaCls}`}>
                          {delta > 0 ? '+' : ''}
                          {delta.toLocaleString('es-ES', {
                            maximumFractionDigits: 1,
                          })}{' '}
                          kg
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="reg-ex-sets">
                  {/*
                    Solo kg · las reps no se miden en este menú porque
                    el seguimiento (PRs, evolución de carga) se basa
                    exclusivamente en peso. El campo `reps` del schema
                    se mantiene en el tipo `SerieRegistrada` para
                    retrocompatibilidad con docs viejos que pudieran
                    tenerlo, pero la UI ya no lo muestra ni lo edita.
                  */}
                  {sets.map((s, i) => (
                    <div key={i} className="reg-set-row">
                      <span className="reg-set-num">{i + 1}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="reg-set-input"
                        placeholder="kg"
                        value={s.kg}
                        onChange={(e) =>
                          handleSetChange(ej.nombre, i, 'kg', e.target.value)
                        }
                        aria-label={`Serie ${i + 1} kg`}
                        /* maxLength=6 cubre "9999,5" / "150,5" / "1234"
                           · cualquier carga humana real cabe holgada
                           y evita que el campo se desborde visualmente
                           si el user pega texto largo por error. */
                        maxLength={6}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="reg-day-panel-field">
        <label className="reg-day-panel-label" htmlFor={`reg-notes-${fecha}`}>
          <MealIcon value="tb:notes-2" size={14} className="reg-day-panel-label-icon" />
          Notas del día <span className="reg-day-panel-hint">(opcional)</span>
        </label>
        <textarea
          id={`reg-notes-${fecha}`}
          className="reg-day-panel-textarea"
          maxLength={NOTES_MAX}
          rows={3}
          placeholder="¿Cómo te sentiste? ¿Algo a destacar?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="reg-day-panel-charcount">
          {notes.length} / {NOTES_MAX}
        </div>
      </div>

      {errorMsg && <div className="reg-day-panel-error">{errorMsg}</div>}

      {(planValue || registro) && (
        <div className="reg-day-panel-actions">
          <button
            type="button"
            className="reg-day-panel-save"
            disabled={saving || !planValue}
            onClick={blurAndRun(handleRequestSave)}
          >
            ✓ Guardar registro
          </button>
          {registro && (
            <button
              type="button"
              className="reg-day-panel-delete"
              disabled={saving}
              onClick={blurAndRun(() => setConfirmDelete(true))}
            >
              <MealIcon value="tb:trash" size={16} />
              <span>Eliminar registro</span>
            </button>
          )}
        </div>
      )}

      <IonAlert
        isOpen={confirmDelete}
        header="¿Eliminar registro?"
        message="Se borrará el registro de este día (pesos y notas)."
        buttons={[
          { text: 'Cancelar', role: 'cancel', handler: () => setConfirmDelete(false) },
          { text: 'Eliminar', role: 'destructive', handler: handleDelete },
        ]}
        onDidDismiss={() => setConfirmDelete(false)}
      />

      <IonAlert
        isOpen={confirmRemoveEx !== null}
        header="¿Eliminar ejercicio?"
        message={
          confirmRemoveEx
            ? `Se quitará "${confirmRemoveEx}" del registro de este día.`
            : ''
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel', handler: () => setConfirmRemoveEx(null) },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              if (confirmRemoveEx) handleRemoveExercise(confirmRemoveEx);
            },
          },
        ]}
        onDidDismiss={() => setConfirmRemoveEx(null)}
      />

      <ConfirmDiffAlert
        pending={pendingSave}
        onCancel={() => setPendingSave(null)}
        onConfirm={() => void handleConfirmSave()}
      />

      {/*
        Eliminar series (estilo v1) · checkbox por serie con su kg
        para que el user identifique cuáles eliminar. Réplica de
        `regOpenDeleteSeries` del v1: marca las que quieras quitar,
        pulsa "Eliminar". Se borran de mayor a menor índice y las
        restantes se renumeran 1..N en el render (porque key={i}).
      */}
      <IonAlert
        isOpen={deleteSeriesAlert !== null}
        header={
          deleteSeriesAlert
            ? `Eliminar series · ${deleteSeriesAlert.exName}`
            : 'Eliminar series'
        }
        message={
          deleteSeriesAlert?.sets.length
            ? 'Selecciona las series que quieres eliminar:'
            : 'No hay series que eliminar.'
        }
        inputs={
          deleteSeriesAlert
            ? deleteSeriesAlert.sets.map((s, i) => {
                const kg = s.kg.trim();
                const detail = kg ? ` · ${kg} kg` : ' · vacía';
                return {
                  type: 'checkbox' as const,
                  label: `Serie ${i + 1}${detail}`,
                  value: i,
                  checked: false,
                };
              })
            : []
        }
        buttons={
          deleteSeriesAlert?.sets.length
            ? [
                { text: 'Cancelar', role: 'cancel', handler: () => setDeleteSeriesAlert(null) },
                {
                  text: 'Eliminar',
                  role: 'destructive',
                  handler: (selected: number[]) => {
                    if (!deleteSeriesAlert) return;
                    const indices = Array.isArray(selected)
                      ? selected.map((v) => Number(v)).filter((n) => Number.isFinite(n))
                      : [];
                    handleApplyDeleteSeries(deleteSeriesAlert.exName, indices);
                  },
                },
              ]
            : [{ text: 'Cerrar', role: 'cancel', handler: () => setDeleteSeriesAlert(null) }]
        }
        onDidDismiss={() => setDeleteSeriesAlert(null)}
      />

      {/*
        Info del ejercicio · réplica del tooltip del v1 (`regToggleInfoTip`).
        En desktop el `title=""` HTML mostraría tooltip al hover, pero en
        móvil no se ve · este alert lo arregla con un click explícito.
      */}
      <IonAlert
        isOpen={infoExName !== null}
        header={infoExName ?? ''}
        message={
          infoExName
            ? `El número de series viene del plan (${infoExSeries ?? '—'}).`
              + ` Usa "🗑 Series" para eliminar series concretas en este registro,`
              + ` o "🗑 Ejercicio" para excluir este ejercicio del día sin tocar el plan.`
            : ''
        }
        buttons={['Entendido']}
        onDidDismiss={() => {
          setInfoExName(null);
          setInfoExSeries(null);
        }}
      />

      {/*
        Descartar cambios · si hay edits sin guardar y el user pulsa
        "Cerrar", confirmamos antes de perder los kg/notas.
      */}
      <IonAlert
        isOpen={discardConfirm}
        header="¿Descartar cambios?"
        message="Tienes modificaciones sin guardar. Si cierras ahora, los kg y notas que hayas escrito se perderán."
        buttons={[
          {
            text: 'Seguir editando',
            role: 'cancel',
            handler: () => setDiscardConfirm(false),
          },
          {
            text: 'Descartar',
            role: 'destructive',
            handler: () => {
              setDiscardConfirm(false);
              onClose();
            },
          },
        ]}
        onDidDismiss={() => setDiscardConfirm(false)}
      />
    </div>
  );
}
