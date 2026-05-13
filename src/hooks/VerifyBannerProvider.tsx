import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { VerifyBannerContext, type VerifyBannerState } from './verify-banner-context';

// Provider compartido SOLO para el estado `sent` (email enviado en esta
// sesión). Así si el usuario pulsa "Verificar" en Dashboard, al ir a Settings
// también ve "Email enviado". El cierre (X) del banner es local a cada
// página — no se comparte.
export function VerifyBannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const verified = user?.emailVerified ?? false;

  const [sent, setSent] = useState(false);

  // Reset cuando cambia el user o se verifica — sin useEffect (state-from-prop).
  const [prevKey, setPrevKey] = useState(`${uid ?? ''}|${verified}`);
  const currentKey = `${uid ?? ''}|${verified}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setSent(false);
  }

  // Memoizamos las acciones y el value · sin esto el Provider re-renderiza
  // arrastra a todos los consumidores aunque `sent` no haya cambiado (el
  // árbol vive bajo AuthProvider, que se re-renderiza cada vez que cambia
  // cualquier campo del user · sin estabilizar referencias propagamos
  // re-renders por cascada).
  const markSent = useCallback(() => setSent(true), []);
  const reset = useCallback(() => setSent(false), []);

  const value = useMemo<VerifyBannerState>(
    () => ({ sent, markSent, reset }),
    [sent, markSent, reset],
  );

  return <VerifyBannerContext.Provider value={value}>{children}</VerifyBannerContext.Provider>;
}
