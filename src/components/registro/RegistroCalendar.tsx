import { useMemo, useState } from 'react';
import { IonAlert } from '@ionic/react';
import { MealIcon } from '../MealIcon';
import type { RegistroDia } from '../../templates/defaultUser';
import { todayDateStr } from '../../utils/dateKeys';
import type { RegistroCalView } from '../../utils/units';

// Calendar de la tab Registro · grid mensual o semanal con dots de
// estado (train / rest / today / selected) por celda. Réplica funcional
// del v1 (`renderCal`, `renderCalWeek`) pero como componente declarativo:
// el padre controla la posición (year/month0/view) y la fecha
// seleccionada · este componente solo notifica cambios vía callbacks.
//
// La fuente de verdad de los registros es `byDate` (la suscripción del
// mes actual desde `useRegistroMes`). Los días sin registro renderizan
// como celda neutra; los días con `plan='rest'` como `.cal-day.rest` y
// los días con plan de entreno como `.cal-day.train`.

const MES_LABELS_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DOW_SHORT_MON = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DOW_SHORT_SUN = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

// Fecha mínima del calendar · réplica del v1 (`CAL_START = new Date(2026, 0, 1)`).
// La app se desplegó en 2026 · no hay datos de registro antes, así que
// bloqueamos la navegación a meses anteriores. Las celdas con fecha
// previa se renderizan dimmed/no clickables y los botones prev/filtro
// se desactivan al alcanzar el límite.
const MIN_YEAR = 2026;
const MIN_MONTH0 = 0; // Enero
const MIN_DATE_KEY = '2026-01-01';

// Convierte (year, month0, day) → 'YYYY-MM-DD'.
function fmtKey(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Construye una matriz fila×col (6×7 para mes, 1×7 para semana) con la
// celda de cada día visible. Para mes: arranca del primer día de la
// semana (Lu o Do según preferencia) que CONTIENE el día 1, así las
// celdas iniciales pueden caer en el mes anterior. Idem para el final.
interface CalCell {
  fecha: string;       // 'YYYY-MM-DD'
  dayNum: number;      // 1..31
  isOtherMonth: boolean;
  isToday: boolean;
  isDisabled: boolean; // < MIN_DATE_KEY · no clickable
}

function buildMonthGrid(
  year: number,
  month0: number,
  weekStart: 'monday' | 'sunday',
  todayKey: string,
): CalCell[] {
  // Día de la semana del 1 del mes (0=domingo .. 6=sábado en JS).
  const firstDay = new Date(year, month0, 1);
  const firstDayJs = firstDay.getDay(); // 0..6
  // Cuántos días "atrás" llenamos en la primera fila.
  const offsetBack =
    weekStart === 'monday'
      ? (firstDayJs + 6) % 7  // lunes = 0, martes = 1, ..., domingo = 6
      : firstDayJs;            // domingo = 0, lunes = 1, ..., sábado = 6
  // Día visible más antiguo del grid.
  const startDate = new Date(year, month0, 1 - offsetBack);

  const cells: CalCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const fecha = fmtKey(d.getFullYear(), d.getMonth(), d.getDate());
    cells.push({
      fecha,
      dayNum: d.getDate(),
      isOtherMonth: d.getMonth() !== month0,
      isToday: fecha === todayKey,
      isDisabled: fecha < MIN_DATE_KEY,
    });
  }
  return cells;
}

// Para vista semana · 7 celdas que contienen el día seleccionado o, si
// no hay seleccionado, la fecha de hoy. Misma lógica de inicio de
// semana que el grid mensual.
function buildWeekRow(
  anchorFecha: string,
  weekStart: 'monday' | 'sunday',
  todayKey: string,
): CalCell[] {
  const [y, m, d] = anchorFecha.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const anchorDow = anchor.getDay();
  const offsetBack =
    weekStart === 'monday' ? (anchorDow + 6) % 7 : anchorDow;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - offsetBack);

  const cells: CalCell[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const fecha = fmtKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
    cells.push({
      fecha,
      dayNum: dt.getDate(),
      isOtherMonth: false, // en vista semana no aplica
      isToday: fecha === todayKey,
      isDisabled: fecha < MIN_DATE_KEY,
    });
  }
  return cells;
}

export interface RegistroCalendarProps {
  byDate: Record<string, RegistroDia>;
  year: number;
  month0: number;
  view: RegistroCalView;
  selectedDate: string | null;
  weekStart: 'monday' | 'sunday';
  onChangePos: (next: { year: number; month0: number; view: RegistroCalView }) => void;
  onSelectDate: (fecha: string) => void;
}

export function RegistroCalendar({
  byDate,
  year,
  month0,
  view,
  selectedDate,
  weekStart,
  onChangePos,
  onSelectDate,
}: RegistroCalendarProps) {
  const today = todayDateStr();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterY, setFilterY] = useState(year);
  const [filterM0, setFilterM0] = useState(month0);
  // Tooltip que explica el código de colores de las celdas (descanso
  // azul · entreno lima · hoy borde cyan · seleccionado fondo lima).
  // Vive aquí para que el padre no tenga que conocer el detalle interno.
  const [infoOpen, setInfoOpen] = useState(false);

  const dowLabels = weekStart === 'monday' ? DOW_SHORT_MON : DOW_SHORT_SUN;

  const cells = useMemo(() => {
    if (view === 'week') {
      const anchor = selectedDate ?? today;
      return buildWeekRow(anchor, weekStart, today);
    }
    return buildMonthGrid(year, month0, weekStart, today);
  }, [view, year, month0, selectedDate, weekStart, today]);

  // Helper para clase CSS de una celda según el registro de ese día.
  function cellClass(c: CalCell): string {
    const reg = byDate[c.fecha];
    const classes = ['cal-day'];
    if (c.isOtherMonth) classes.push('other');
    if (c.isDisabled) classes.push('disabled');
    if (c.isToday) classes.push('today');
    if (selectedDate === c.fecha) classes.push('selected');
    if (reg && !c.isDisabled) {
      if (reg.plan === 'rest') classes.push('rest');
      else if (reg.plan && reg.plan !== '') classes.push('train');
    }
    return classes.join(' ');
  }

  // Comparador "estamos en o por debajo del límite mínimo" para
  // desactivar el botón "‹" cuando ya estamos en enero 2026.
  const atMinMonth = year < MIN_YEAR || (year === MIN_YEAR && month0 <= MIN_MONTH0);

  function navMonth(delta: number) {
    let nextY = year;
    let nextM0 = month0 + delta;
    if (nextM0 < 0) {
      nextY -= 1;
      nextM0 = 11;
    } else if (nextM0 > 11) {
      nextY += 1;
      nextM0 = 0;
    }
    // Clamp a MIN_YEAR/MIN_MONTH0 · si el delta nos llevaría antes
    // de enero 2026, lo bloqueamos en lugar de retroceder más.
    if (nextY < MIN_YEAR || (nextY === MIN_YEAR && nextM0 < MIN_MONTH0)) {
      nextY = MIN_YEAR;
      nextM0 = MIN_MONTH0;
    }
    onChangePos({ year: nextY, month0: nextM0, view });
  }

  function goToday() {
    const dt = new Date();
    onChangePos({ year: dt.getFullYear(), month0: dt.getMonth(), view });
    onSelectDate(today);
  }

  function setView(v: RegistroCalView) {
    onChangePos({ year, month0, view: v });
  }

  function applyFilter() {
    // Clamp · si user elige un mes/año previo al min, lo subimos a
    // enero 2026. (También limitado por el rango del select, pero
    // doble seguro para que no pueda llegar un valor fuera de rango.)
    let y = filterY;
    let m = filterM0;
    if (y < MIN_YEAR || (y === MIN_YEAR && m < MIN_MONTH0)) {
      y = MIN_YEAR;
      m = MIN_MONTH0;
    }
    onChangePos({ year: y, month0: m, view });
    setFilterOpen(false);
  }

  // Generador de años para el dropdown · desde MIN_YEAR (2026) hasta
  // 5 años por delante del actual o del year prop, lo que sea mayor.
  // Nunca expone años previos a 2026 (el v1 lo hacía igual con CAL_START).
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const maxY = Math.max(cur + 5, year);
    const arr: number[] = [];
    for (let y = MIN_YEAR; y <= maxY; y++) arr.push(y);
    return arr;
  }, [year]);

  // En el filtro de meses · si el año seleccionado ES MIN_YEAR, los
  // meses anteriores a MIN_MONTH0 se ocultan (no aplica con MIN_MONTH0=0
  // pero futurproof: si subimos el min a, ej. abril 2026, el dropdown
  // de meses se ajustará automáticamente).
  const monthOptions = useMemo(() => {
    const start = filterY === MIN_YEAR ? MIN_MONTH0 : 0;
    const out: { i: number; label: string }[] = [];
    for (let i = start; i < 12; i++) {
      out.push({ i, label: MES_LABELS_LARGOS[i] });
    }
    return out;
  }, [filterY]);

  return (
    <div className="reg-cal">
      <div className="reg-cal-nav">
        <div className="reg-cal-nav-left">
          <button
            type="button"
            className="reg-cal-nav-btn"
            onClick={() => navMonth(-1)}
            disabled={atMinMonth}
            aria-label="Mes anterior"
          >
            <MealIcon value="tb:chevron-left" size={20} />
          </button>
          <button
            type="button"
            className="reg-cal-month-label"
            onClick={() => {
              setFilterY(year);
              setFilterM0(month0);
              setFilterOpen((v) => !v);
            }}
            aria-expanded={filterOpen}
            aria-label="Cambiar mes y año"
          >
            {MES_LABELS_LARGOS[month0]} {year}
          </button>
          <button
            type="button"
            className="reg-cal-nav-btn"
            onClick={() => navMonth(1)}
            aria-label="Mes siguiente"
          >
            <MealIcon value="tb:chevron-right" size={20} />
          </button>
        </div>
        <div className="reg-cal-nav-right">
          {/* Botón ⓘ a la izquierda del "Hoy" · abre IonAlert con la
              leyenda de colores del calendar (descanso azul, entreno
              lima, hoy borde cyan, día seleccionado fondo lima). */}
          <button
            type="button"
            className="reg-cal-info-btn"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              setInfoOpen(true);
            }}
            aria-label="Información sobre el código de colores del calendario"
            title="¿Qué significa cada color?"
          >
            <MealIcon value="tb:info-circle" size={18} />
          </button>
          <button
            type="button"
            className="reg-cal-today-btn"
            onClick={goToday}
            aria-label="Ir a hoy"
          >
            <MealIcon value="tb:calendar-month" size={16} />
            <span>Hoy</span>
          </button>
        </div>
      </div>

      <div className="reg-cal-view-toggle">
        <span className="reg-cal-view-label">Vista:</span>
        <button
          type="button"
          className={`reg-cal-view-btn${view === 'month' ? ' is-active' : ''}`}
          onClick={() => setView('month')}
        >
          Mes
        </button>
        <button
          type="button"
          className={`reg-cal-view-btn${view === 'week' ? ' is-active' : ''}`}
          onClick={() => setView('week')}
        >
          Semana
        </button>
      </div>

      {filterOpen && (
        <div className="reg-cal-filter btal-anim-fade-up">
          <span className="reg-cal-filter-label">
            <MealIcon value="tb:calendar" size={16} className="reg-cal-filter-label-icon" />
            Ir a
          </span>
          <select
            className="reg-cal-filter-select"
            value={filterM0}
            onChange={(e) => setFilterM0(parseInt(e.target.value, 10))}
            aria-label="Mes"
          >
            {monthOptions.map((m) => (
              <option key={m.i} value={m.i}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className="reg-cal-filter-select"
            value={filterY}
            onChange={(e) => setFilterY(parseInt(e.target.value, 10))}
            aria-label="Año"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="reg-cal-filter-go"
            onClick={applyFilter}
          >
            Ir
          </button>
          <button
            type="button"
            className="reg-cal-filter-close"
            onClick={() => setFilterOpen(false)}
            aria-label="Cerrar filtro"
          >
            ✕
          </button>
        </div>
      )}

      <div className="reg-cal-grid">
        {dowLabels.map((d, i) => (
          <div key={`dow-${i}`} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <button
            key={`${c.fecha}-${i}`}
            type="button"
            className={cellClass(c)}
            onClick={() => {
              if (!c.isDisabled) onSelectDate(c.fecha);
            }}
            disabled={c.isDisabled}
            aria-label={`${c.dayNum} ${MES_LABELS_LARGOS[parseInt(c.fecha.slice(5, 7), 10) - 1]}${c.isDisabled ? ' (no disponible)' : ''}`}
            aria-current={c.isToday ? 'date' : undefined}
            aria-pressed={selectedDate === c.fecha ? true : undefined}
          >
            <span className="cal-day-num">{c.dayNum}</span>
            <span className="cal-dot" aria-hidden />
          </button>
        ))}
      </div>

      {/* Leyenda de colores · texto plano sin emojis (los colores los
          renderiza CSS via ::before en cada bullet del message). El
          IonAlert no soporta JSX inline así que la leyenda usa solo
          texto · suficiente para entenderse. */}
      <IonAlert
        isOpen={infoOpen}
        onDidDismiss={() => setInfoOpen(false)}
        header="Código de colores del calendario"
        message={
          'AZUL · día con descanso registrado.\n\n'
          + 'LIMA · día con plan de entreno registrado.\n\n'
          + 'BORDE CYAN · día de hoy.\n\n'
          + 'FONDO LIMA · día seleccionado actualmente.\n\n'
          + 'Sin color · día sin registro · pulsa para añadir uno.'
        }
        buttons={['Entendido']}
      />
    </div>
  );
}
