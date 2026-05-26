// Cookie consent store · estado puro (sin React) para que `services/
// analytics.ts` pueda leerlo sin acoplarse al árbol de componentes.
//
// La fuente de verdad vive en localStorage para que la elección persista
// entre sesiones. Suscriptores se notifican via callback (patrón pub/sub
// simple) · `useCookieConsent` lo expone como hook React.
//
// ¿Por qué localStorage y no una cookie?
//   - Irónicamente, usar una cookie para guardar "no quiero cookies" es
//     legalmente problemático en algunas interpretaciones de ePrivacy.
//   - localStorage técnico estrictamente necesario (almacenar preferencia
//     del user) está exento de consentimiento bajo ePrivacy art. 5(3).
//   - Misma razón por la que los banners profesionales (CookieBot, etc.)
//     usan localStorage para guardar la decisión.

const STORAGE_KEY = 'btal_cookie_consent_v1';

export type ConsentState = 'accepted' | 'rejected' | 'undecided';

const subscribers = new Set<(accepted: boolean) => void>();

function readStored(): ConsentState {
  if (typeof window === 'undefined') return 'undecided';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'accepted') return 'accepted';
    if (raw === 'rejected') return 'rejected';
    return 'undecided';
  } catch {
    return 'undecided';
  }
}

export function getConsentState(): ConsentState {
  return readStored();
}

export function hasAnalyticsConsent(): boolean {
  return readStored() === 'accepted';
}

export function setConsent(state: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // private mode · best effort
  }
  // Notificar a todos los suscriptores (analytics, banner, settings).
  subscribers.forEach((cb) => {
    try {
      cb(state === 'accepted');
    } catch {
      /* swallow */
    }
  });
}

export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
  subscribers.forEach((cb) => {
    try {
      cb(false);
    } catch {
      /* swallow */
    }
  });
}

export function onConsentChange(cb: (accepted: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
