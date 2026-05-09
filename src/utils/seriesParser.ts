// Parser/formatter de series · réplica del v1 (peParseSeries +
// peFormatSeries). El schema guarda `Ejercicio.series` como string
// libre tipo "4×6-8" / "3×10" · este módulo lo descompone en
// {s, r1, r2} para el editor con selectores y lo recompone al guardar.
//
// Tolera ambos separadores: × / x / X / * para series y - / – para
// rango. Útil cuando vienen datos de la IA o el user copia/pega.

export interface ParsedSeries {
  s: string;   // series · "4"
  r1: string;  // reps mínimas · "6"
  r2: string;  // reps máximas (vacío si no hay rango) · "8"
}

const SERIES_REGEX = /^\s*(\d+)\s*[×xX*]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/;

export function parseSeries(str: string): ParsedSeries {
  const m = SERIES_REGEX.exec((str || '').trim());
  return m ? { s: m[1], r1: m[2], r2: m[3] || '' } : { s: '', r1: '', r2: '' };
}

// Serializa a "S×R" o "S×R1-R2" · cadena vacía si faltan S o R1.
// Si R2 <= R1, lo ignora (no es un rango válido) y devuelve "S×R1".
export function formatSeries(s: string, r1: string, r2: string): string {
  const S = String(s || '').trim();
  const R1 = String(r1 || '').trim();
  const R2 = String(r2 || '').trim();
  if (!S || !R1) return '';
  if (R2 && parseInt(R2, 10) > parseInt(R1, 10)) {
    return `${S}×${R1}-${R2}`;
  }
  return `${S}×${R1}`;
}

// Genera array de opciones [1..max] para los <select> de series/reps.
// Cliente: <option value="">—</option> + las numéricas. Lo dejamos
// como array de strings para que React renderice <option key+value>
// en map · más limpio que innerHTML.
export function numOptions(max: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= max; i++) out.push(String(i));
  return out;
}

// Detecta si una cadena de series tiene formato no estándar (p. ej.
// "30 min", "AMRAP", "3×60s"). Útil para mostrar un fallback en el
// editor cuando el parser no logra extraer S/R1.
export function isFreeFormatSeries(str: string): boolean {
  if (!str.trim()) return false;
  return !SERIES_REGEX.test(str.trim());
}
