// Helpers de la tab Registro · Sub-fase 2E. Réplica de las funciones
// del v1 (`getRegPlanDay`, `regBadgesCombined`, `regPlanLabel`,
// `regPlanShortLabel`, `regSeriesCount`) adaptadas al schema React de
// la app v2: leen `entrenos.planes` directamente del UserDocument
// (mismo origen que EntrenoPage / TrainSheet) en lugar del DOM o
// localStorage como hacía el v1.

import type { DiaEntreno, Entrenos, PlanEntreno } from '../templates/defaultUser';
import { badgeLabel } from '../templates/exerciseCatalog';
import { DAY_LABEL_SHORT, type DayKey } from '../templates/defaultUser';

export interface RegPlanDayInfo {
  plan: PlanEntreno;
  day: DiaEntreno;
  planId: string;
  dayIdx: number;
}

// Resuelve 'PLANID|DAYINDEX' → { plan, day, planId, dayIdx }. Devuelve
// null si el value es 'rest', vacío, o si el plan/día no existen.
export function getRegPlanDay(
  planValue: string,
  entrenos: Entrenos | undefined | null,
): RegPlanDayInfo | null {
  if (!planValue || planValue === 'rest' || !entrenos) return null;
  const [planId, dayIdxStr] = planValue.split('|');
  if (!planId || dayIdxStr === undefined) return null;
  const plan = entrenos.planes[planId];
  if (!plan) return null;
  const dayIdx = parseInt(dayIdxStr, 10);
  if (Number.isNaN(dayIdx)) return null;
  const day = plan.dias[dayIdx];
  if (!day) return null;
  return { plan, day, planId, dayIdx };
}

// Combina los 1-3 badges de un día en un string "PECHO/TRICEPS/EMPUJE".
// Réplica del v1 (`regBadgesCombined`). Solo añade el 3º si hay 2º (el
// v1 lo hacía por compatibilidad con badges anidados).
export function regBadgesCombined(day: DiaEntreno): string {
  const labels: string[] = [];
  const a = badgeLabel(day.badge, day.badgeCustom);
  const b = badgeLabel(day.badge2, day.badgeCustom2);
  const c = day.badge2 ? badgeLabel(day.badge3, day.badgeCustom3) : null;
  if (a) labels.push(a);
  if (b) labels.push(b);
  if (c) labels.push(c);
  return labels.join(' / ').toUpperCase();
}

// Etiqueta legible larga para mostrar en el selector de plan del
// RegDayPanel · ej. "Plan 4 Días · Lun — Día 1 · Día A · Empuje
// (PECHO/TRICEPS/EMPUJE)". Si planValue='rest' devuelve 'DESCANSO'.
export function regPlanLabel(
  planValue: string,
  entrenos: Entrenos | undefined | null,
): string {
  if (planValue === 'rest') return 'DESCANSO';
  const info = getRegPlanDay(planValue, entrenos);
  if (!info) return planValue;
  const { plan, day, dayIdx } = info;
  const badges = regBadgesCombined(day);
  const planName = plan.nombre || '';
  const dowKey = day.diaSemana as DayKey | null;
  const dowPrefix = dowKey ? `${DAY_LABEL_SHORT[dowKey]} — ` : '';
  const titulo = day.titulo ? ` · ${day.titulo}` : '';
  const head = `${dowPrefix}Día ${dayIdx + 1}${titulo}`;
  const parts = planName ? [planName, head] : [head];
  return badges ? `${parts.join(' · ')} (${badges})` : parts.join(' · ');
}

// Etiqueta corta · solo los badges combinados. Útil para celdas del
// calendar o badges resumen rápido.
export function regPlanShortLabel(
  planValue: string,
  entrenos: Entrenos | undefined | null,
): string {
  if (planValue === 'rest') return 'DESCANSO';
  const info = getRegPlanDay(planValue, entrenos);
  if (!info) return '';
  return regBadgesCombined(info.day);
}

// Parsea el campo `series` de un Ejercicio ("4×6-8" / "3x10" / "5 X 5"
// / "30 min") y devuelve el número de series. Si no se puede extraer,
// usa 3 como default (mismo fallback que el v1).
export function regSeriesCount(seriesStr: string): number {
  const m = /^(\d+)\s*[×xX*]/.exec((seriesStr || '').trim());
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 3;
}

// Una opción del selector de plan del RegDayPanel.
export interface PlanOption {
  value: string;             // 'PLANID|DAYINDEX' o 'rest'
  label: string;             // texto humano
  isRest: boolean;
  isRecommended: boolean;    // si el planId == recommendedPlanId
}

// Resultado agrupado de `enumeratePlanOptions` · usado para renderizar
// el selector con `<optgroup>`s separados:
//   - predeterminados · planes builtIn 1..7 días
//   - personalizados · planes custom creados por el user
//   - rest · única opción de "DESCANSO" (siempre disponible)
export interface PlanOptionsGroups {
  predeterminados: PlanOption[];
  personalizados: PlanOption[];
  rest: PlanOption;
}

// Enumera las combinaciones plan-día del UserDocument.entrenos para el
// selector del RegDayPanel.
//
//   - `filterDayKey` (opcional): si se pasa, solo se incluyen las
//     entradas plan-día cuya `diaSemana` coincida con la del día
//     seleccionado en el calendar. Es decir, si el user clica un
//     martes, solo aparecerán los días de plan asignados a martes.
//     Si un plan no tiene NINGÚN día asignado al `filterDayKey`, ese
//     plan queda fuera del selector. Pasar `null`/`undefined`
//     desactiva el filtro y vuelve al comportamiento histórico
//     (todas las combinaciones plan-día).
//
//   - Agrupación: builtIn van a `predeterminados`, custom (sin
//     importar `esPredeterminado`) a `personalizados`. Cada grupo
//     ordenado: builtIn por nº de días (1..7), custom alfabético
//     por nombre del plan.
//
//   - DESCANSO siempre disponible (no se filtra por día) · va en
//     `rest` · el caller lo renderiza al final.
export function enumeratePlanOptions(
  entrenos: Entrenos | undefined | null,
  recommendedPlanId: string | null,
  filterDayKey?: DayKey | null,
): PlanOptionsGroups {
  const restOpt: PlanOption = {
    value: 'rest',
    label: 'DESCANSO',
    isRest: true,
    isRecommended: false,
  };
  const result: PlanOptionsGroups = {
    predeterminados: [],
    personalizados: [],
    rest: restOpt,
  };
  if (!entrenos) return result;

  const planIds = Object.keys(entrenos.planes);
  // Ordenamos por grupos · builtIn por nº de días, custom alfabético
  // por nombre. La separación efectiva al output se hace abajo.
  planIds.sort((a, b) => {
    const planA = entrenos.planes[a];
    const planB = entrenos.planes[b];
    if (!planA || !planB) return 0;
    if (planA.builtIn && !planB.builtIn) return -1;
    if (!planA.builtIn && planB.builtIn) return 1;
    if (planA.builtIn && planB.builtIn) {
      const nA = parseInt(a, 10) || 99;
      const nB = parseInt(b, 10) || 99;
      return nA - nB;
    }
    return planA.nombre.localeCompare(planB.nombre);
  });

  for (const planId of planIds) {
    const plan = entrenos.planes[planId];
    if (!plan?.dias?.length) continue;
    for (let i = 0; i < plan.dias.length; i++) {
      const dia = plan.dias[i];
      // Filtro por día de semana · solo incluimos los días del plan
      // que coinciden con el día de la fecha seleccionada en el
      // calendar. Si el día del plan no tiene `diaSemana` asignado
      // queda fuera del filtro (aceptable: si no especificaste
      // qué día del plan toca el martes, no se sugiere para martes).
      if (filterDayKey && dia.diaSemana !== filterDayKey) continue;
      const value = `${planId}|${i}`;
      const opt: PlanOption = {
        value,
        label: regPlanLabel(value, entrenos),
        isRest: false,
        isRecommended: planId === recommendedPlanId,
      };
      if (plan.builtIn) result.predeterminados.push(opt);
      else result.personalizados.push(opt);
    }
  }

  return result;
}

// Fecha 'YYYY-MM-DD' formateada legible · "Sábado 9 de mayo de 2026".
// Locale fijo español (la app no soporta i18n todavía).
export function formatFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return fecha;
  const dt = new Date(y, m - 1, d);
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const dows = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
  ];
  return `${dows[dt.getDay()]} ${d} de ${meses[m - 1]} de ${y}`;
}

// Fecha 'YYYY-MM-DD' formateada corta · "Sáb 9 may". Para títulos de
// día seleccionado en cards compactas.
export function formatFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return fecha;
  const dt = new Date(y, m - 1, d);
  const mesesShort = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  const dowsShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dowsShort[dt.getDay()]} ${d} ${mesesShort[m - 1]}`;
}
