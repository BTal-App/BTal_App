import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  // iOS Safari < 16.4 expone navigator.standalone; el resto display-mode.
  const iosLegacy = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosLegacy || window.matchMedia?.('(display-mode: standalone)').matches === true;
};

export const signUpEmail = async (email: string, password: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred;
};

export const signInEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

// En PWA standalone (iOS) signInWithPopup falla silenciosamente — los popups
// están bloqueados por el WebView. Caemos a redirect, y Landing recoge el
// resultado al volver vía consumePendingRedirect().
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
