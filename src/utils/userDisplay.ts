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

// Fecha numérica en formato dd/mm/aaaa (ej. "05/05/2026").
// Acepta el string ISO que devuelve user.metadata.creationTime / lastSignInTime.
// Numérico para que entre en una sola línea en celdas estrechas (móvil).
export function formatDate(input: string | undefined | null): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

// Etiqueta humana para los providerId de Firebase Auth.
export function providerLabel(providerId: string): string {
  const map: Record<string, string> = {
    password: 'Email y contraseña',
    'google.com': 'Google',
    anonymous: 'Anónimo',
    'apple.com': 'Apple',
    'facebook.com': 'Facebook',
    'github.com': 'GitHub',
    'microsoft.com': 'Microsoft',
    'twitter.com': 'X (Twitter)',
  };
  return map[providerId] ?? providerId;
}
