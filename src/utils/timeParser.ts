// Parser/formatter de "tiempo estimado de entrenamiento" · acepta
// múltiples formatos en input ("45", "45min", "1h", "1h 20min",
// "1h20", "90min") y los normaliza a minutos enteros.

const HORAS_REGEX = /(\d+)\s*h/i;
const MINUTOS_REGEX = /(\d+)\s*(?:min|m)/i;
const SOLO_NUMERO = /^\s*(\d+)\s*$/;

// Convierte texto libre a minutos · null si no se puede parsear o
// el resultado es 0/negativo. Tolera formatos:
//   "45"        → 45
//   "45min"     → 45
//   "45 min"    → 45
//   "1h"        → 60
//   "1h 20min"  → 80
//   "1h20"      → 80 (formato compacto)
//   "2h 5"      → 125 (h + min sin sufijo)
//   "90"        → 90
//   "  "        → null
export function parseTiempoEstimado(input: string): number | null {
  const trimmed = (input ?? '').trim().toLowerCase();
  if (!trimmed) return null;

  // Solo número · asumimos minutos.
  const soloNum = SOLO_NUMERO.exec(trimmed);
  if (soloNum) {
    const n = parseInt(soloNum[1], 10);
    return n > 0 ? n : null;
  }

  // Extrae horas y minutos del texto.
  let horas = 0;
  let minutos = 0;
  const horasMatch = HORAS_REGEX.exec(trimmed);
  if (horasMatch) horas = parseInt(horasMatch[1], 10);
  const minutosMatch = MINUTOS_REGEX.exec(trimmed);
  if (minutosMatch) {
    minutos = parseInt(minutosMatch[1], 10);
  } else if (horasMatch) {
    // No se encontró "min" explícito · busca un segundo número
    // tras la "h" (formato "1h20" o "2h 5"). El primer número ya
    // está consumido como horas.
    const rest = trimmed.slice(horasMatch.index + horasMatch[0].length);
    const restNum = /(\d+)/.exec(rest);
    if (restNum) minutos = parseInt(restNum[1], 10);
  }

  const total = horas * 60 + minutos;
  return total > 0 ? total : null;
}

// Convierte minutos a string visible · usado para mostrar el campo
// y para el value inicial del input al editar. Reglas:
//   45  → "45m"
//   60  → "1h"
//   75  → "1h 15m"
//   120 → "2h"
//   null → ""
export function formatTiempoEstimado(min: number | null | undefined): string {
  if (min === null || min === undefined || min <= 0) return '';
  const horas = Math.floor(min / 60);
  const mins = min % 60;
  if (horas === 0) return `${mins}m`;
  if (mins === 0) return `${horas}h`;
  return `${horas}h ${mins}m`;
}
