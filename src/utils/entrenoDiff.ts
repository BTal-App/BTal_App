// Diff helpers para los editores de plan/día · réplica del v1
// (savePlanModal `planChanges` + `_peExerciseChanges`). Producen una
// lista de cambios "antes → después" que se muestran en un IonAlert
// "¿Confirmar cambios?" antes de persistir el guardado.

import type {
  DiaEntreno,
  Ejercicio,
  EjercicioBadge,
  PlanEntreno,
} from '../templates/defaultUser';
import { badgeLabel } from '../templates/exerciseCatalog';
import { formatDiaSemana } from './diaSemana';
import {
  type ChangeEntry,
  safeStr as SAFE,
} from './confirmDiff';
import { formatTiempoEstimado } from './timeParser';

export type { ChangeEntry } from './confirmDiff';
export { formatChangesHtml, pushDiff } from './confirmDiff';

const formatBadge = (
  badge: EjercicioBadge | '',
  custom: string,
): string => {
  if (!badge) return '—';
  return badgeLabel(badge, custom) ?? '—';
};

const formatEjercicio = (ej: Ejercicio | undefined): string => {
  if (!ej) return '—';
  const nombre = ej.nombre.trim();
  if (!nombre) return '—';
  const series = ej.series.trim();
  return series ? `${nombre} · ${series}` : nombre;
};

// Compara dos arrays de ejercicios y devuelve cambios por ejercicio
// (nuevo / eliminado / modificado). Réplica del v1 `_peExerciseChanges`.
export function diffEjercicios(
  oldList: Ejercicio[] | undefined,
  newList: Ejercicio[] | undefined,
  diaIdx: number,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const prefix = `Día ${diaIdx + 1} · Ej.`;
  const max = Math.max(oldList?.length ?? 0, newList?.length ?? 0);
  for (let j = 0; j < max; j++) {
    const o = oldList?.[j];
    const n = newList?.[j];
    const oName = o?.nombre.trim() ?? '';
    const nName = n?.nombre.trim() ?? '';
    if (!oName && !nName) continue;
    if (!oName && nName) {
      out.push({
        label: `${prefix} ${j + 1} (nuevo)`,
        from: '—',
        to: formatEjercicio(n),
      });
      continue;
    }
    if (oName && !nName) {
      out.push({
        label: `${prefix} ${j + 1} (eliminado)`,
        from: formatEjercicio(o),
        to: '—',
      });
      continue;
    }
    // Ambos existen · diff por campo (nombre/desc/series).
    const oDesc = o?.desc.trim() ?? '';
    const nDesc = n?.desc.trim() ?? '';
    const oSer = o?.series.trim() ?? '';
    const nSer = n?.series.trim() ?? '';
    if (oName !== nName)
      out.push({
        label: `${prefix} ${j + 1} — Nombre`,
        from: oName,
        to: nName,
      });
    if (oDesc !== nDesc)
      out.push({
        label: `${prefix} ${j + 1} — Notas`,
        from: SAFE(oDesc),
        to: SAFE(nDesc),
      });
    if (oSer !== nSer)
      out.push({
        label: `${prefix} ${j + 1} — Series`,
        from: SAFE(oSer),
        to: SAFE(nSer),
      });
  }
  return out;
}

// Compara dos días enteros · réplica del v1 (parte del savePlanModal).
// Útil tanto desde DiaEditorModal (un día) como desde PlanEditorModal
// (lo invoca por cada índice).
export function diffDia(
  oldD: DiaEntreno | undefined,
  newD: DiaEntreno,
  diaIdx: number,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const prefix = `Día ${diaIdx + 1}`;
  if (!oldD) {
    // Día nuevo · todo es " — → valor "
    out.push({
      label: `${prefix} (nuevo)`,
      from: '—',
      to: SAFE(newD.titulo),
    });
    if (newD.diaSemana)
      out.push({
        label: `${prefix} — Día semana`,
        from: '—',
        to: formatDiaSemana(newD.diaSemana),
      });
    if (newD.descripcion)
      out.push({
        label: `${prefix} — Descripción`,
        from: '—',
        to: newD.descripcion,
      });
    if (newD.tiempoEstimadoMin)
      out.push({
        label: `${prefix} — Tiempo estimado`,
        from: '—',
        to: formatTiempoEstimado(newD.tiempoEstimadoMin),
      });
    if (newD.badge)
      out.push({
        label: `${prefix} — Tipo`,
        from: '—',
        to: formatBadge(newD.badge, newD.badgeCustom),
      });
    if (newD.badge2)
      out.push({
        label: `${prefix} — Tipo 2`,
        from: '—',
        to: formatBadge(newD.badge2, newD.badgeCustom2),
      });
    if (newD.badge3)
      out.push({
        label: `${prefix} — Tipo 3`,
        from: '—',
        to: formatBadge(newD.badge3, newD.badgeCustom3),
      });
    diffEjercicios([], newD.ejercicios, diaIdx).forEach((c) => out.push(c));
    return out;
  }
  // Diff campo a campo
  if (oldD.titulo !== newD.titulo)
    out.push({
      label: `${prefix} — Título`,
      from: SAFE(oldD.titulo),
      to: SAFE(newD.titulo),
    });
  if (oldD.descripcion !== newD.descripcion)
    out.push({
      label: `${prefix} — Descripción`,
      from: SAFE(oldD.descripcion),
      to: SAFE(newD.descripcion),
    });
  if ((oldD.tiempoEstimadoMin ?? null) !== (newD.tiempoEstimadoMin ?? null))
    out.push({
      label: `${prefix} — Tiempo estimado`,
      from: oldD.tiempoEstimadoMin
        ? formatTiempoEstimado(oldD.tiempoEstimadoMin)
        : '—',
      to: newD.tiempoEstimadoMin
        ? formatTiempoEstimado(newD.tiempoEstimadoMin)
        : '—',
    });
  if ((oldD.diaSemana ?? '') !== (newD.diaSemana ?? ''))
    out.push({
      label: `${prefix} — Día semana`,
      from: oldD.diaSemana ? formatDiaSemana(oldD.diaSemana) : '—',
      to: newD.diaSemana ? formatDiaSemana(newD.diaSemana) : '—',
    });
  const oldB1 = formatBadge(oldD.badge, oldD.badgeCustom);
  const newB1 = formatBadge(newD.badge, newD.badgeCustom);
  if (oldB1 !== newB1)
    out.push({ label: `${prefix} — Tipo`, from: oldB1, to: newB1 });
  const oldB2 = formatBadge(oldD.badge2, oldD.badgeCustom2);
  const newB2 = formatBadge(newD.badge2, newD.badgeCustom2);
  if (oldB2 !== newB2)
    out.push({ label: `${prefix} — Tipo 2`, from: oldB2, to: newB2 });
  const oldB3 = formatBadge(oldD.badge3, oldD.badgeCustom3);
  const newB3 = formatBadge(newD.badge3, newD.badgeCustom3);
  if (oldB3 !== newB3)
    out.push({ label: `${prefix} — Tipo 3`, from: oldB3, to: newB3 });
  diffEjercicios(oldD.ejercicios, newD.ejercicios, diaIdx).forEach((c) =>
    out.push(c),
  );
  if ((oldD.comentario ?? '') !== (newD.comentario ?? ''))
    out.push({
      label: `${prefix} — Comentario`,
      from: SAFE(oldD.comentario),
      to: SAFE(newD.comentario),
    });
  return out;
}

// Diff completo de plan · réplica del v1 (savePlanModal + _peExerciseChanges).
// Recibe undefined como `oldP` cuando es plan nuevo y devuelve cada
// campo nuevo como "— → valor".
export function diffPlan(
  oldP: PlanEntreno | undefined,
  newP: PlanEntreno,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  if (!oldP) {
    out.push({ label: 'Nombre', from: '—', to: SAFE(newP.nombre) });
    if (newP.estructura)
      out.push({ label: 'Estructura', from: '—', to: newP.estructura });
    if (newP.estructura2)
      out.push({
        label: 'Sub-estructura',
        from: '—',
        to: newP.estructura2,
      });
    out.push({
      label: 'Días de entrenamiento',
      from: '—',
      to: `${newP.dias.length} día${newP.dias.length === 1 ? '' : 's'}`,
    });
    if (newP.esPredeterminado) {
      out.push({ label: 'Predeterminado', from: '—', to: 'Sí' });
    }
    newP.dias.forEach((d, i) => {
      diffDia(undefined, d, i).forEach((c) => out.push(c));
    });
    return out;
  }
  // Modo edit · field-by-field
  if (oldP.nombre !== newP.nombre)
    out.push({
      label: 'Nombre',
      from: SAFE(oldP.nombre),
      to: SAFE(newP.nombre),
    });
  if (oldP.estructura !== newP.estructura)
    out.push({
      label: 'Estructura',
      from: SAFE(oldP.estructura),
      to: SAFE(newP.estructura),
    });
  if (oldP.estructura2 !== newP.estructura2)
    out.push({
      label: 'Sub-estructura',
      from: SAFE(oldP.estructura2),
      to: SAFE(newP.estructura2),
    });
  // Sub-fase 2D.1 · cambio del flag "predeterminado" · solo aplica
  // a planes custom (los builtIn nunca lo cambian). Mostramos como
  // "Sí" / "No" en el diff antes/después.
  const oldPred = !!oldP.esPredeterminado;
  const newPred = !!newP.esPredeterminado;
  if (oldPred !== newPred)
    out.push({
      label: 'Predeterminado',
      from: oldPred ? 'Sí' : 'No',
      to: newPred ? 'Sí' : 'No',
    });
  const oldN = oldP.dias.length;
  const newN = newP.dias.length;
  if (oldN !== newN)
    out.push({
      label: 'Nº de días',
      from: `${oldN} día${oldN === 1 ? '' : 's'}`,
      to: `${newN} día${newN === 1 ? '' : 's'}`,
    });
  // Diff por día · si el plan tiene más días en `new`, los nuevos
  // entran como "Día N (nuevo)". Si tiene menos, los días borrados
  // los señalamos como deleted.
  const max = Math.max(oldN, newN);
  for (let i = 0; i < max; i++) {
    const oldD = oldP.dias[i];
    const newD = newP.dias[i];
    if (oldD && !newD) {
      out.push({
        label: `Día ${i + 1} (eliminado)`,
        from: SAFE(oldD.titulo),
        to: '—',
      });
      continue;
    }
    if (!newD) continue;
    diffDia(oldD, newD, i).forEach((c) => out.push(c));
  }
  return out;
}

// (formatChangesHtml + ChangeEntry + safeStr/SAFE viven en confirmDiff
// y se re-exportan al inicio de este archivo · evitamos duplicar.)
