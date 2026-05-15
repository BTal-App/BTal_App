import { useEffect, useMemo, useState } from 'react';
import { IonModal } from '@ionic/react';
import { MealIcon } from '../MealIcon';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { getRegistrosRecientes } from '../../services/db';
import {
  defaultRegistroStats,
  type RegistroDia,
  type SupHistoryEntry,
} from '../../templates/defaultUser';
import {
  aggregateSupHistory,
  calcRachaHistory,
  entrenosPorSemana,
  exerciseHistoryAsPoints,
  exerciseOptions,
  prsTable,
  sumSupHistory,
  SUP_PERIOD_LABEL,
  type StreakInterval,
  type SupPeriod,
} from '../../utils/graphsAggregation';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import './GraphsModal.css';

// Modal de gráficos · accesible desde ProfileSheet → "Gráficos".
// 5 tabs:
//   1. Entrenos       · bar chart de entrenamientos por ISO week (últimas 12)
//   2. Pesos          · selector de ejercicio + line chart del exerciseHistory
//   3. PR's           · tabla ordenada por kg desc
//   4. Rachas         · bar chart de mejores rachas de entrenos consecutivos
//   5. Suplementación · counters semana/mes/año/total para batido y creatina
//
// Los datos salen de:
//   - tab 1 / 4: query a /registros (últimos 999 días · histórico
//     completo realista) al montar
//   - tab 2 / 3: registroStats del UserDocument (vía useProfile)
//   - tab 5: suplementos counters del UserDocument
//
// Iconografía · Tabler outline para coherencia con el resto de la app.

type TabKey = 'entrenos' | 'prs' | 'pesos' | 'rachas' | 'suplementos';

// Orden de tabs · el render usa `Object.keys(TAB_LABELS)` así que el
// orden de inserción aquí es el orden visual. JS preserva el orden de
// keys string en objetos.
// Solo label · las tabs de categorías van sin icono (en móvil estrecho
// se ocultaban igualmente y en web descentraban respecto al texto · más
// limpio y consistente sin ellos).
const TAB_LABELS: Record<TabKey, { label: string }> = {
  entrenos:    { label: 'Entrenos' },
  pesos:       { label: 'Pesos' },
  prs:         { label: "PR's" },
  rachas:      { label: 'Rachas' },
  suplementos: { label: 'Supl.' },
};

export interface GraphsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GraphsModal({ isOpen, onClose }: GraphsModalProps) {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [tab, setTab] = useState<TabKey>('entrenos');

  // Carga lazy de los registros recientes · solo cuando se abre el
  // modal (y se mantiene en cache mientras esté abierto). Al cerrar,
  // limpiamos para que la próxima apertura recargue datos frescos.
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [loadingReg, setLoadingReg] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    let mounted = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingReg(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // 999 días (no 90) · consistente con RACHA_FETCH_LIMIT de
    // useRegistroStats · así la tab Rachas refleja el MISMO histórico
    // que el badge de HoyPage (antes Rachas se capaba a 90d y no
    // coincidía). Entrenos sigue mostrando solo 12 semanas (lo recorta
    // entrenosPorSemana) · PR's salen de registroStats (no afectado).
    getRegistrosRecientes(user.uid, 999)
      .then((arr) => {
        if (mounted) setRegistros(arr);
      })
      .catch((err) => {
        // Tratamos un fallo de query como "sin datos" para no asustar
        // al usuario. Casos típicos donde esto pasa de forma legítima:
        //   - Invitado nuevo · subcolección /registros nunca creada
        //   - Adblocker bloqueando endpoints específicos de Firestore
        //   - Token aún propagándose tras signInAnonymously
        // En todos esos casos, el `BarChart` con su `emptyMessage`
        // comunica correctamente "Aún no hay entrenamientos
        // registrados". Logueamos el error solo para debug.
        console.warn('[GraphsModal] load registros failed', err);
        if (mounted) setRegistros([]);
      })
      .finally(() => {
        if (mounted) setLoadingReg(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, user]);

  // Reset al cerrar para que la próxima apertura no muestre datos
  // viejos durante el fetch.
  useEffect(() => {
    if (!isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRegistros([]);
      setTab('entrenos');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // ── Datos derivados ──────────────────────────────────────────────
  const stats = userDoc?.registroStats ?? defaultRegistroStats();
  const sup = userDoc?.suplementos;

  const entrenosData = useMemo(
    () => entrenosPorSemana(registros, 12),
    [registros],
  );
  const rachaHistory = useMemo(
    () => calcRachaHistory(registros),
    [registros],
  );
  const prRows = useMemo(() => prsTable(stats.prs), [stats.prs]);
  const exOptions = useMemo(
    () => exerciseOptions(stats.exerciseHistory),
    [stats.exerciseHistory],
  );

  // Selector ejercicio para tab Pesos · default al primero del listing.
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Sync de selección con la lista de opciones disponibles · si el
    // ejercicio elegido desaparece (datos cambiaron), saltamos al
    // primero. Si nunca se ha elegido, también seleccionamos el
    // primero por defecto.
    if (selectedEx === null && exOptions.length > 0) {
      setSelectedEx(exOptions[0].exNorm);
    } else if (
      selectedEx !== null
      && !exOptions.some((o) => o.exNorm === selectedEx)
    ) {
      setSelectedEx(exOptions[0]?.exNorm ?? null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [exOptions, selectedEx]);

  const exHistoryPoints = useMemo(() => {
    if (!selectedEx) return [];
    const history = stats.exerciseHistory[selectedEx] ?? [];
    return exerciseHistoryAsPoints(history);
  }, [stats.exerciseHistory, selectedEx]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="graphs-modal"
      breakpoints={[0, 0.92, 1]}
      initialBreakpoint={0.92}
      handle
    >
      <div className="graphs-modal-content">
        {/* Header · título + cerrar */}
        <div className="graphs-modal-head">
          <h2 className="graphs-modal-title">
            <MealIcon value="tb:chart-line" size={22} className="graphs-modal-title-icon" />
            Gráficos
          </h2>
          <button
            type="button"
            className="graphs-modal-close"
            onClick={onClose}
            aria-label="Cerrar gráficos"
          >
            <MealIcon value="tb:x" size={22} />
          </button>
        </div>

        {/* Tabs · scroll horizontal en pantallas estrechas */}
        <div className="graphs-modal-tabs" role="tablist">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => {
            const meta = TAB_LABELS[k];
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                className={`graphs-modal-tab${active ? ' is-active' : ''}`}
                onClick={() => setTab(k)}
              >
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido · `key={tab}` fuerza desmontar+remontar al cambiar
            de tab para que la animación CSS `btal-anim-fade-up` se
            re-dispare. Coste aceptable: las tabs no tienen state
            interno persistente que se pierda (excepto TabSuplementos
            con `period`, que reset a 'week' es comportamiento OK). */}
        <div key={tab} className="graphs-modal-body btal-anim-fade-up">
          {tab === 'entrenos' && (
            <TabEntrenos data={entrenosData} loading={loadingReg} />
          )}
          {tab === 'prs' && <TabPRs rows={prRows} />}
          {tab === 'pesos' && (
            <TabPesos
              options={exOptions}
              selected={selectedEx}
              onSelect={setSelectedEx}
              points={exHistoryPoints}
            />
          )}
          {tab === 'rachas' && (
            <TabRachas history={rachaHistory} loading={loadingReg} />
          )}
          {tab === 'suplementos' && (
            <TabSuplementos
              batidoHistory={sup?.batidoHistory}
              creatinaHistory={sup?.creatinaHistory}
            />
          )}
        </div>
      </div>
    </IonModal>
  );
}

// ── Sub-componentes de cada tab ─────────────────────────────────────

function TabEntrenos({
  data,
  loading,
}: {
  data: { label: string; value: number }[];
  loading: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="graphs-tab">
      <div className="graphs-tab-head">
        <h3>Entrenamientos por semana</h3>
        <p>Últimas 12 semanas · solo cuenta días con plan de entreno (los descansos se excluyen).</p>
      </div>
      {loading && <div className="graphs-loading">Cargando datos…</div>}
      {!loading && (
        <>
          <BarChart
            data={data}
            unit="entrenos"
            emptyMessage="Aún no hay entrenamientos registrados."
          />
          <div className="graphs-summary">
            Total en este periodo: <strong>{total}</strong>{' '}
            {total === 1 ? 'entrenamiento' : 'entrenamientos'}
          </div>
        </>
      )}
    </div>
  );
}

function TabRachas({
  history,
  loading,
}: {
  history: StreakInterval[];
  loading: boolean;
}) {
  // Top 10 por longitud (ya viene ordenado desc de calcRachaHistory).
  const top = history.slice(0, 10);
  const longest = history[0]?.length ?? 0;
  const active = history.find((s) => s.endedBy === 'active');
  const current = active?.length ?? 0;

  // "YYYY-MM-DD" → "DD/MM/AAAA" · texto en prosa del rango histórico.
  const dmy = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  // "YYYY-MM-DD" → "DD/MM/AA" · labels del eje X (más cortas → el chart
  // queda centrado en vez de empujado por fechas largas · el detalle
  // completo sigue en el tooltip <title> de cada barra).
  const dmys = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };
  // Span real cubierto por el histórico · del primer entreno de la
  // racha más antigua al último de la más reciente. Responde a "hasta
  // cuándo duran / qué periodo cubren los gráficos".
  const allStarts = history.map((s) => s.start).sort();
  const allEnds = history.map((s) => s.end).sort();
  const spanFrom = allStarts[0];
  const spanTo = allEnds[allEnds.length - 1];

  return (
    <div className="graphs-tab">
      <div className="graphs-tab-head">
        <h3>Historial de rachas</h3>
        <p>
          Tus mejores rachas de entrenamientos consecutivos. Una racha se
          rompe con un día de descanso o un día sin registrar nada. La racha
          en curso aparece resaltada.
        </p>
      </div>
      {loading && <div className="graphs-loading">Cargando datos…</div>}
      {!loading && history.length === 0 && (
        <div className="graphs-empty">
          Aún no tienes rachas. Cuando entrenes días seguidos, tus mejores
          rachas aparecerán aquí.
        </div>
      )}
      {!loading && history.length > 0 && (
        <>
          <BarChart
            data={top.map((s) => ({
              label: s.start === s.end
                ? dmys(s.start)
                : `${dmys(s.start)}–${dmys(s.end)}`,
              value: s.length,
              highlight: s.endedBy === 'active' ? 'gold' : null,
            }))}
            unit={top[0].length === 1 ? 'día' : 'días'}
            color="var(--btal-coral)"
            height={180}
            scrollable
            emptyMessage="Aún no tienes rachas registradas."
          />
          <div className="graphs-summary">
            Mejor racha:{' '}
            <strong>
              {longest} {longest === 1 ? 'día' : 'días'}
            </strong>
            {current > 0 && (
              <>
                {' · '}Racha actual:{' '}
                <strong>
                  {current} {current === 1 ? 'día' : 'días'}
                </strong>
              </>
            )}
            {history.length > 10 && (
              <>
                {' · '}+{history.length - 10} rachas más
              </>
            )}
          </div>
          {spanFrom && spanTo && (
            <p className="graphs-note">
              <MealIcon
                value="tb:info-circle"
                size={14}
                className="graphs-note-icon"
              />
              Histórico desde el <strong>{dmy(spanFrom)}</strong> hasta el{' '}
              <strong>{dmy(spanTo)}</strong> · se conservan los últimos
              999 días de registros.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TabPRs({ rows }: { rows: { exercise: string; kg: number; fecha: string }[] }) {
  const top = rows.slice(0, 12);
  return (
    <div className="graphs-tab">
      <div className="graphs-tab-head">
        <h3>Personal Records</h3>
        <p>Tu peso máximo histórico por ejercicio (ordenado del más alto al más bajo).</p>
      </div>
      {rows.length === 0 ? (
        <div className="graphs-empty">
          Aún no has alcanzado ningún PR. Cuando guardes un registro con un peso superior al de sesiones anteriores, aparecerá aquí.
        </div>
      ) : (
        <>
          {/* Bar chart horizontal de los top 8 · usa BarChart con los
              kg como value. Los nombres son largos así que el chart
              auto-rota labels (>=8 entries). */}
          {top.length >= 2 && (
            <BarChart
              data={top.slice(0, 8).map((r) => ({
                // En scrollable hay más ancho por barra · permitimos
                // labels más largas antes de truncar (18 vs 13).
                label:
                  r.exercise.length > 18
                    ? r.exercise.slice(0, 17) + '…'
                    : r.exercise,
                value: r.kg,
                highlight: 'gold',
              }))}
              unit="kg"
              color="var(--btal-gold)"
              height={170}
              scrollable
            />
          )}
          <ul className="graphs-pr-list">
            {top.map((r, i) => {
              // Stagger limitado a 8 · más allá entran sin delay para
              // no acumular >320 ms de lag visible.
              const staggerCls = i < 8 ? `btal-stagger-${i + 1}` : '';
              return (
                <li
                  key={r.exercise}
                  className={`graphs-pr-row btal-anim-fade-up ${staggerCls}`}
                >
                  <span className="graphs-pr-name">{r.exercise}</span>
                  <span className="graphs-pr-kg">
                    {r.kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg
                  </span>
                  <span className="graphs-pr-fecha">{r.fecha}</span>
                </li>
              );
            })}
          </ul>
          {rows.length > 12 && (
            <p className="graphs-summary">
              + {rows.length - 12} ejercicios más con récord
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TabPesos({
  options,
  selected,
  onSelect,
  points,
}: {
  options: { exNorm: string; exDisplay: string; sessions: number }[];
  selected: string | null;
  onSelect: (exNorm: string) => void;
  points: { label: string; value: number }[];
}) {
  return (
    <div className="graphs-tab">
      <div className="graphs-tab-head">
        <h3>Evolución de peso por ejercicio</h3>
        <p>Selecciona un ejercicio para ver cómo ha evolucionado tu carga máxima por sesión (últimas 10 sesiones registradas).</p>
      </div>

      {options.length === 0 ? (
        <div className="graphs-empty">
          Aún no has registrado pesos en ningún ejercicio. Cuando guardes un registro con kg, aparecerá aquí.
        </div>
      ) : (
        <>
          <select
            className="graphs-select"
            value={selected ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.exNorm} value={o.exNorm}>
                {o.exDisplay} ({o.sessions} {o.sessions === 1 ? 'sesión' : 'sesiones'})
              </option>
            ))}
          </select>

          <LineChart
            data={points}
            unit="kg"
            emptyMessage="Solo hay 1 sesión · necesitas al menos 2 puntos para dibujar la evolución."
          />

          {points.length > 0 && (
            <div className="graphs-summary">
              Min: <strong>{Math.min(...points.map((p) => p.value))} kg</strong> · Max:{' '}
              <strong>{Math.max(...points.map((p) => p.value))} kg</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// TabSuplementos · ahora con histórico fechado real (Sub-fase 2E.1).
//
// Period selector (Día / Semana / Mes / Año) que cambia el bucketing
// del bar chart. La data viene de `sup.batidoHistory` / `creatinaHistory`,
// poblados desde ProfileProvider en cada marca/cancela/incremento/
// decremento. Buckets vacíos rellenados con 0 para que el eje X sea
// consistente entre user con datos y sin datos.
//
// IMPORTANT · Sacado fuera del componente padre `GraphsModal` porque
// tiene state interno (`period`) · si fuera una function inner del
// padre, se redefiniría cada render y React perdería el state al
// re-montar. Mismo patrón que aprendimos con StatCard del StatsGrid.

interface TabSuplementosProps {
  batidoHistory: SupHistoryEntry[] | undefined;
  creatinaHistory: SupHistoryEntry[] | undefined;
}

function TabSuplementos({
  batidoHistory,
  creatinaHistory,
}: TabSuplementosProps) {
  const [period, setPeriod] = useState<SupPeriod>('week');

  const batidoData = useMemo(
    () => aggregateSupHistory(batidoHistory, period),
    [batidoHistory, period],
  );
  const creatinaData = useMemo(
    () => aggregateSupHistory(creatinaHistory, period),
    [creatinaHistory, period],
  );

  const batidoTotal = useMemo(() => sumSupHistory(batidoHistory), [batidoHistory]);
  const creatinaTotal = useMemo(
    () => sumSupHistory(creatinaHistory),
    [creatinaHistory],
  );

  return (
    <div className="graphs-tab">
      <div className="graphs-tab-head">
        <h3>Suplementación tomada</h3>
        <p>
          Histórico fechado de tus tomas (batido protéico y creatina suelta).
          Cada vez que pulsas "Tomar" o ajustas manualmente desde HoyPage, se
          registra con la fecha. Cambia el periodo para ver detalle distinto.
        </p>
      </div>

      <div className="graphs-period-selector" role="tablist" aria-label="Periodo">
        {(
          [
            { p: 'day' as SupPeriod,   label: 'Día' },
            { p: 'week' as SupPeriod,  label: 'Semana' },
            { p: 'month' as SupPeriod, label: 'Mes' },
            { p: 'year' as SupPeriod,  label: 'Año' },
          ]
        ).map((opt) => (
          <button
            key={opt.p}
            type="button"
            role="tab"
            aria-selected={period === opt.p}
            className={`graphs-period-btn${period === opt.p ? ' is-active' : ''}`}
            onClick={() => setPeriod(opt.p)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="graphs-sup-block btal-anim-fade-up btal-stagger-1">
        <h4 className="graphs-sup-title">
          <MealIcon value="tb:cup" size={18} className="graphs-sup-title-icon" />
          Batidos protéicos
        </h4>
        <BarChart
          data={batidoData}
          unit="batidos"
          height={150}
          emptyMessage="Aún no has registrado ningún batido."
        />
        <div className="graphs-summary">
          {SUP_PERIOD_LABEL[period]} · <strong>{batidoTotal}</strong>{' '}
          {batidoTotal === 1 ? 'batido en histórico total' : 'batidos en histórico total'}
        </div>
      </div>

      <div className="graphs-sup-block btal-anim-fade-up btal-stagger-2">
        <h4 className="graphs-sup-title">
          <MealIcon value="tb:ladle" size={18} className="graphs-sup-title-icon" />
          Creatina (dosis sueltas)
        </h4>
        <BarChart
          data={creatinaData}
          unit="dosis"
          color="var(--btal-violet)"
          height={150}
          emptyMessage="Aún no has registrado dosis de creatina."
        />
        <div className="graphs-summary">
          {SUP_PERIOD_LABEL[period]} · <strong>{creatinaTotal}</strong>{' '}
          {creatinaTotal === 1 ? 'dosis en histórico total' : 'dosis en histórico total'}
        </div>
      </div>

      <p className="graphs-note">
        <MealIcon value="tb:info-circle" size={14} className="graphs-note-icon" />
        El histórico se conserva los últimos 366 días · entries más
        antiguas se descartan automáticamente para mantener tu doc
        ligero. El gráfico siempre muestra el rango del periodo
        seleccionado, aunque haya buckets a 0.
      </p>
    </div>
  );
}
