// Reglas de la contraseña nueva · FUENTE ÚNICA para toda la app.
// La usan: signup (Landing), restablecer contraseña (AuthAction),
// cambiar contraseña (ChangePasswordModal) y vincular invitado →
// cuenta (LinkGuestAccountModal). Alimenta tanto la validación de
// envío (`validatePasswordStrength`) como el checklist en vivo
// (`<PasswordChecklist>`), así nunca se desincronizan.
export const PWD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: 'La contraseña debe tener al menos 8 caracteres.' },
  { test: (p) => /[A-Z]/.test(p), label: 'Debe incluir al menos una letra mayúscula.' },
  { test: (p) => /[0-9]/.test(p), label: 'Debe incluir al menos un número.' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Debe incluir al menos un carácter especial.' },
];

// Devuelve el texto de la primera regla incumplida, o null si todas
// se cumplen. Se usa como gate antes de enviar el formulario.
export function validatePasswordStrength(pwd: string): string | null {
  const failing = PWD_RULES.find((r) => !r.test(pwd));
  return failing ? failing.label : null;
}
