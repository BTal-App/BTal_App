import type { User } from 'firebase/auth';

// Devuelve hasta 2 iniciales en mayúscula para el avatar fallback.
// Si no hay nombre ni email, cae a '?'.
export function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

// Primer nombre o nick para saludos cortos: "¡Hola, Pablo!".
// Devuelve null si no hay displayName útil (entonces el saludo va sin nombre).
export function greetingName(user: User): string | null {
  const dn = user.displayName?.trim();
  if (!dn) return null;
  return dn.split(/\s+/)[0] || null;
}
