import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../hooks/useCookieConsent';
import './CookieConsentBanner.css';

/**
 * Banner inferior que pide consentimiento para usar Firebase Analytics
 * (cookies `_ga`, `_ga_*`) en la versión web/PWA.
 *
 * NO se muestra en:
 *   - App nativa Capacitor (privacy gestionado vía App Store Privacy
 *     Labels iOS + Play Data Safety Android · sin cookies en WebView
 *     porque Analytics nativo usa IDFV/GAID, no cookies)
 *   - User ya decidió (state !== 'undecided')
 *
 * Persiste decisión en localStorage (no cookie · ePrivacy art. 5(3)
 * permite localStorage estrictamente necesario sin consent).
 */
export function CookieConsentBanner() {
  const { state, accept, reject } = useCookieConsent();
  const [mounted, setMounted] = useState(false);

  // Pequeño delay para que el banner no aparezca durante el splash
  // y para permitir transición CSS slide-in suave.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (Capacitor.isNativePlatform()) return null;
  if (state !== 'undecided') return null;

  return (
    <div
      className={`cookie-banner ${mounted ? 'cookie-banner--visible' : ''}`}
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div className="cookie-banner-inner">
        <div className="cookie-banner-content">
          <div id="cookie-banner-title" className="cookie-banner-title">
            Cookies de analíticas
          </div>
          <div id="cookie-banner-desc" className="cookie-banner-desc">
            Usamos Firebase Analytics (Google) para entender qué partes de
            la app se usan más y detectar problemas. Puedes rechazarlo y la
            app sigue funcionando exactamente igual. Más info en{' '}
            <Link to="/legal/privacidad" className="cookie-banner-link">
              nuestra política
            </Link>
            .
          </div>
        </div>
        <div className="cookie-banner-actions">
          <button
            type="button"
            className="cookie-banner-btn cookie-banner-btn--reject"
            onClick={reject}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="cookie-banner-btn cookie-banner-btn--accept"
            onClick={accept}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
