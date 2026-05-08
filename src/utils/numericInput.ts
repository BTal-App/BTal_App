// Helpers compartidos para inputs numéricos · evitan que el user
// introduzca negativos, decimales con coma, exponentes, letras, etc.
// Centralizados aquí para que todos los inputs de macros y dosis se
// comporten igual y no haya divergencias entre editores.

// Bloquea teclas no numéricas en un input type="number". También
// bloquea el separador decimal cuando solo aceptamos enteros (que es
// nuestro caso · macros/gramos siempre son enteros). Dejamos pasar
// teclas de control (backspace, flechas, tab, copy/paste shortcuts).
export function blockNonInteger(e: React.KeyboardEvent<HTMLInputElement>): void {
  // Permitimos teclas de control y combinaciones con Ctrl/Meta (cmd+c).
  if (e.ctrlKey || e.metaKey) return;
  const allowed = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'Home',
    'End',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ];
  if (allowed.includes(e.key)) return;
  // Solo dígitos 0-9. Bloqueamos "-" (negativos), "+", "e"/"E"
  // (exponentes científicos), ",", "." (decimales) y cualquier letra.
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

// Sanea una string al pegar/escribir · deja solo dígitos. Útil cuando
// el browser igualmente acepta caracteres raros (mobile keyboards a
// veces no respetan onKeyDown). Usar en onChange como segunda capa.
export function sanitizeIntegerString(s: string): string {
  return s.replace(/[^0-9]/g, '');
}

// Convierte string saneada a número con clamp [min, max]. Devuelve 0
// si la string está vacía. Útil para `value` de los onChange.
export function clampInt(s: string, min: number, max: number): number {
  const cleaned = sanitizeIntegerString(s);
  if (cleaned === '') return min;
  const n = parseInt(cleaned, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
