import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  multiFactor,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  TotpMultiFactorGenerator,
  type MultiFactorInfo,
  type TotpSecret,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  // iOS Safari < 16.4 expone navigator.standalone; el resto display-mode.
  const iosLegacy = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosLegacy || window.matchMedia?.('(display-mode: standalone)').matches === true;
};

export const signUpEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

// El email de verificación NO se envía en signUp — se envía cuando el usuario
// pulsa "Verificar" en el banner. Así sabe que está pasando algo, no le llega
// un correo sorpresa que parece phishing.
export const sendVerificationEmail = (user: User) =>
  sendEmailVerification(user);

export const signInEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

// En PWA standalone (iOS) signInWithPopup falla silenciosamente — los popups
// están bloqueados por el WebView. Caemos a redirect, y AuthProvider recoge
// el resultado al volver vía consumePendingRedirect().
export const signInGoogle = async () => {
  const provider = new GoogleAuthProvider();
  if (isStandalone()) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  return signInWithPopup(auth, provider);
};

export const signInGuest = () => signInAnonymously(auth);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);

export const signOut = () => fbSignOut(auth);

// Llamar una sola vez al arrancar la app (en AuthProvider).
// Si el usuario vuelve de un redirect de Google, Firebase ya habrá actualizado
// onAuthStateChanged; esta llamada solo limpia el estado interno y propaga errores.
export const consumePendingRedirect = () => getRedirectResult(auth);

// ────────────────────────────────────────────────────────────────────────────
// Reauth · operaciones sensibles (cambio de email, enrolar MFA) requieren
// sesión reciente. Si Firebase devuelve auth/requires-recent-login,
// llamamos a uno de estos según cómo se autenticó el usuario.

export const reauthEmail = (user: User, password: string) => {
  if (!user.email) throw new Error('Usuario sin email no puede reauth con password');
  const cred = EmailAuthProvider.credential(user.email, password);
  return reauthenticateWithCredential(user, cred);
};

export const reauthGoogle = (user: User) =>
  reauthenticateWithPopup(user, new GoogleAuthProvider());

// ────────────────────────────────────────────────────────────────────────────
// Multi-Factor Authentication (TOTP)

export const getEnrolledTotpFactor = (user: User): MultiFactorInfo | null => {
  const factors = multiFactor(user).enrolledFactors;
  return factors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? null;
};

// Paso 1: genera el secreto TOTP. Devuelve también la URL otpauth:// para QR.
export const startTotpEnrollment = async (
  user: User,
): Promise<{ secret: TotpSecret; qrUrl: string }> => {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const accountName = user.email ?? user.uid;
  const qrUrl = secret.generateQrCodeUrl(accountName, 'BTal');
  return { secret, qrUrl };
};

// Paso 2: el usuario escribe el código de 6 dígitos del Authenticator → enrolar.
export const finishTotpEnrollment = async (
  user: User,
  secret: TotpSecret,
  code: string,
  displayName = 'Authenticator',
) => {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await multiFactor(user).enroll(assertion, displayName);
};

export const unenrollTotp = async (user: User) => {
  const factor = getEnrolledTotpFactor(user);
  if (factor) await multiFactor(user).unenroll(factor);
};
