// Primitivas compartidas para "confirmar cambios" antes de guardar
// (réplica del v1 confirmSave). Cualquier modal que edite datos del
// schema puede importar `ChangeEntry` + `formatChangesHtml` y mostrar
// la lista antes/después en un IonAlert.
//
// Las funciones específicas de diff (diffPlan, diffDia, diffComida,
// etc.) viven cerca de su modal o en utils/<feature>Diff.ts; este
// archivo solo contiene los tipos y el formateo HTML común.

export interface ChangeEntry {
  label: string;
  from: string;
  to: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Renderiza la lista de cambios como HTML con "antes" en naranja y
// "después" en verde · réplica visual del v1 confirmSave (#f0a040 /
// #7ee87e). Para usar en IonAlert se envuelve en `IonicSafeString`.
// Si la lista está vacía, muestra "Sin cambios detectados".
export function formatChangesHtml(changes: ChangeEntry[]): string {
  if (changes.length === 0) {
    return '<span style="color:#8d9491">Sin cambios detectados</span>';
  }
  return changes
    .map((c) => {
      const label = escapeHtml(c.label);
      const from = escapeHtml(c.from);
      const to = escapeHtml(c.to);
      return (
        `<strong>${label}</strong><br>`
        + `· Antes: <span style="color:#f0a040">${from}</span><br>`
        + `· Después: <span style="color:#7ee87e">${to}</span>`
      );
    })
    .join('<br><br>');
}

// Helper para campos opcionales · convierte null/undefined/'' en "—"
// para que el diff lea "Antes: — / Después: 5" en vez de "Antes:
// (vacío) / Después: 5".
export const safeStr = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'number' ? String(v) : v.trim();
  return s === '' ? '—' : s;
};

// Compara dos valores y, si difieren, añade un ChangeEntry a la lista.
// Útil para construir diff field-by-field con poco código:
//   pushDiff(out, 'Nombre', oldP.nombre, newP.nombre);
export function pushDiff(
  out: ChangeEntry[],
  label: string,
  oldVal: string | number | null | undefined,
  newVal: string | number | null | undefined,
): void {
  const a = safeStr(oldVal);
  const b = safeStr(newVal);
  if (a !== b) out.push({ label, from: a, to: b });
}
