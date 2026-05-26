import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConsent,
  getConsentState,
  hasAnalyticsConsent,
  onConsentChange,
  setConsent,
} from './cookie-consent-store';

const STORAGE_KEY = 'btal_cookie_consent_v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('cookie-consent-store · estado base', () => {
  it('devuelve undecided cuando localStorage está vacío', () => {
    expect(getConsentState()).toBe('undecided');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('persiste accepted en localStorage', () => {
    setConsent('accepted');
    expect(getConsentState()).toBe('accepted');
    expect(hasAnalyticsConsent()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
  });

  it('persiste rejected en localStorage', () => {
    setConsent('rejected');
    expect(getConsentState()).toBe('rejected');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('clearConsent borra la clave y vuelve a undecided', () => {
    setConsent('accepted');
    clearConsent();
    expect(getConsentState()).toBe('undecided');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('cookie-consent-store · pub/sub', () => {
  it('notifica suscriptores con true al aceptar', () => {
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    setConsent('accepted');
    expect(cb).toHaveBeenCalledWith(true);
    unsub();
  });

  it('notifica suscriptores con false al rechazar', () => {
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    setConsent('rejected');
    expect(cb).toHaveBeenCalledWith(false);
    unsub();
  });

  it('clearConsent notifica con false', () => {
    setConsent('accepted');
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    clearConsent();
    expect(cb).toHaveBeenCalledWith(false);
    unsub();
  });

  it('unsubscribe deja de recibir notificaciones', () => {
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    unsub();
    setConsent('accepted');
    expect(cb).not.toHaveBeenCalled();
  });

  it('un suscriptor que lance no rompe a los demás', () => {
    const broken = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    const unsubBroken = onConsentChange(broken);
    const unsubOk = onConsentChange(ok);
    expect(() => setConsent('accepted')).not.toThrow();
    expect(ok).toHaveBeenCalledWith(true);
    unsubBroken();
    unsubOk();
  });
});

describe('cookie-consent-store · valores corruptos', () => {
  it('trata valor desconocido como undecided', () => {
    localStorage.setItem(STORAGE_KEY, 'maybe');
    expect(getConsentState()).toBe('undecided');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('trata cadena vacía como undecided', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(getConsentState()).toBe('undecided');
  });
});
