// Diff helper para el guardado del Registro · genera la lista de
// cambios "antes → después" que `RegDayPanel` muestra en el modal
// `ConfirmDiffAlert` antes de persistir. Mismo patrón que
// `entrenoDiff` (utils/entrenoDiff.ts) — re-usa `ChangeEntry` y
// `safeStr` de `confirmDiff.ts`.

import type {
  EjercicioRegistrado,
  Entrenos,
  RegistroDia,
} from '../templates/defaultUser';
import { type ChangeEntry, safeStr as SAFE } from './confirmDiff';
import { regPlanLabel } from './registro';

// Formatea una serie individual para el diff · solo kg (las reps no
// se miden en este menú · ver RegDayPanel comentario sobre por qué
// el schema mantiene `reps` para retrocompat pero la UI lo ignora).
function formatSerie(s: { kg: string; reps?: string } | undefined): string {
  if (!s) return '—';
  const kg = s.kg.trim();
  if (!kg) return '—';
  return `${kg} kg`;
}

// Resumen de un ejercicio entero · usado al añadir/eliminar el
// ejercicio entero (no entry-by-entry). "S1: 80 kg · S2: 85 kg ...".
function formatEjercicioResumen(ej: EjercicioRegistrado | undefined): string {
  if (!ej?.sets?.length) return '—';
  const filled = ej.sets
    .map((s, i) => {
      const txt = formatSerie(s);
      return txt === '—' ? null : `S${i + 1}: ${txt}`;
    })
    .filter(Boolean) as string[];
  if (filled.length === 0) return `${ej.sets.length} series vacías`;
  return filled.join(' · ');
}

// Diff completo entre el registro previo (puede ser null si nunca
// guardado) y el siguiente · cubre plan, notas y ejercicios serie a
// serie. Si todo es igual devuelve [].
export function diffRegistroDia(
  old: RegistroDia | null,
  next: RegistroDia,
  entrenos: Entrenos | undefined | null,
): ChangeEntry[] {
  const out: ChangeEntry[] = [];

  // ── Plan ────────────────────────────────────────────────────────────
  const oldPlan = old?.plan ?? '';
  if (oldPlan !== next.plan) {
    out.push({
      label: 'Plan del día',
      from: oldPlan ? regPlanLabel(oldPlan, entrenos) : '—',
      to: next.plan ? regPlanLabel(next.plan, entrenos) : '—',
    });
  }

  // ── Notas ──────────────────────────────────────────────────────────
  if ((old?.notes ?? '') !== (next.notes ?? '')) {
    out.push({
      label: 'Notas del día',
      from: SAFE(old?.notes),
      to: SAFE(next.notes),
    });
  }

  // ── Ejercicios ─────────────────────────────────────────────────────
  // Si el registro era 'rest' o no existía, el bloque de ejercicios
  // de next va completo como "nuevo". Si next es 'rest', todos los
  // ejercicios viejos van como "eliminados". Si ambos son entreno,
  // diff serie a serie.
  const oldExs = old?.exercises ?? {};
  const nextExs = next.exercises ?? {};
  const allNames = new Set<string>([
    ...Object.keys(oldExs),
    ...Object.keys(nextExs),
  ]);

  // Orden estable · por nombre uppercase para que el modal sea
  // determinista.
  const sortedNames = Array.from(allNames).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const name of sortedNames) {
    const o = oldExs[name];
    const n = nextExs[name];

    if (!o && n) {
      // Ejercicio nuevo · solo lo reportamos si tiene al menos una
      // serie con datos. Series 100% vacías no aportan cambio real.
      const summary = formatEjercicioResumen(n);
      if (summary === '—') continue;
      out.push({
        label: `+ ${name.toUpperCase()} (nuevo)`,
        from: '—',
        to: summary,
      });
      continue;
    }

    if (o && !n) {
      out.push({
        label: `− ${name.toUpperCase()} (eliminado)`,
        from: formatEjercicioResumen(o),
        to: '—',
      });
      continue;
    }

    if (o && n) {
      // Diff serie a serie · si el número de series cambió, lo
      // anotamos también explícitamente.
      const oN = o.sets.length;
      const nN = n.sets.length;
      if (oN !== nN) {
        out.push({
          label: `${name.toUpperCase()} · nº series`,
          from: String(oN),
          to: String(nN),
        });
      }
      const max = Math.max(oN, nN);
      for (let i = 0; i < max; i++) {
        const oStr = formatSerie(o.sets[i]);
        const nStr = formatSerie(n.sets[i]);
        if (oStr !== nStr) {
          out.push({
            label: `${name.toUpperCase()} · serie ${i + 1}`,
            from: oStr,
            to: nStr,
          });
        }
      }
    }
  }

  return out;
}
