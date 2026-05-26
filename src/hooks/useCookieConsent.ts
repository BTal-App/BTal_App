import { useCallback, useEffect, useState } from 'react';
import {
  clearConsent,
  getConsentState,
  onConsentChange,
  setConsent,
  type ConsentState,
} from './cookie-consent-store';

export interface UseCookieConsentResult {
  state: ConsentState;
  accept: () => void;
  reject: () => void;
  revoke: () => void;
}

export function useCookieConsent(): UseCookieConsentResult {
  const [state, setState] = useState<ConsentState>(() => getConsentState());

  useEffect(() => {
    return onConsentChange(() => {
      setState(getConsentState());
    });
  }, []);

  const accept = useCallback(() => setConsent('accepted'), []);
  const reject = useCallback(() => setConsent('rejected'), []);
  const revoke = useCallback(() => clearConsent(), []);

  return { state, accept, reject, revoke };
}
