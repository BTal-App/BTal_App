import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { VerifyBannerContext, type VerifyBannerState } from './verify-banner-context';

const DISMISS_PREFIX = 'btal_verify_dismissed_';
const dismissKey = (uid: string) => DISMISS_PREFIX + uid;

// Pequeño bus de subscribers para que useSyncExternalStore sepa cuándo
// re-leer localStorage. Cubre tanto cambios desde la propia pestaña (los
// disparamos a mano) como cambios desde otras pestañas (storage event).
const subscribers = new Set<() => void>();
function subscribe(cb: () => void) {
  subscribers.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    subscribers.delete(cb);
    window.removeEventListener('storage', cb);
  };
}
function notifyAll() {
  subscribers.forEach((cb) => cb());
}

function readDismissed(uid: string | null, verified: boolean): boolean {
  if (!uid || verified) return false;
  try {
    return localStorage.getItem(dismissKey(uid)) === '1';
  } catch {
    return false;
  }
}

export function VerifyBannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const verified = user?.emailVerified ?? false;

  // dismissed se lee directamente de localStorage; useSyncExternalStore lo
  // mantiene sincronizado con cualquier cambio (otra pestaña o nuestro propio
  // notifyAll tras dismiss/reset).
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(uid, verified),
    () => false,
  );

  // sent es estado de sesión (no se persiste). Usamos el patrón state-from-prop
  // para resetearlo cuando cambia uid o se verifica el email.
  const [sent, setSent] = useState(false);
  const [prevKey, setPrevKey] = useState(`${uid ?? ''}|${verified}`);
  const currentKey = `${uid ?? ''}|${verified}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setSent(false);
  }

  const value: VerifyBannerState = {
    dismissed,
    sent,
    dismiss: () => {
      if (uid) {
        try {
          localStorage.setItem(dismissKey(uid), '1');
        } catch {
          /* ignore */
        }
      }
      notifyAll();
    },
    markSent: () => setSent(true),
    reset: () => {
      if (uid) {
        try {
          localStorage.removeItem(dismissKey(uid));
        } catch {
          /* ignore */
        }
      }
      setSent(false);
      notifyAll();
    },
  };

  return <VerifyBannerContext.Provider value={value}>{children}</VerifyBannerContext.Provider>;
}
