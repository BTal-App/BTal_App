import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PUBLIC_HOSTNAME } from '../config/contact';
import './AdblockBanner.css';

// Banner persistente que avisa cuando el navegador del usuario está
// bloqueando las llamadas a Firestore (típicamente uBlock Origin /
// AdGuard con listas anti-tracking demasiado agresivas que cazan
// `firestore.googleapis.com` como si fuera analytics).
//
// Estrategia: en lugar de hacer un ping speculativo (frágil, da
// falsos positivos por CORS/CORB), escuchamos los rechazos no
// manejados (`unhandledrejection`) y errores de red globales. Si
// detectamos un patrón típico de bloqueo de Firebase (mensaje con
// "Failed to fetch" / código "unavailable") en una operación
// reciente, mostramos el banner.
//
// En nativo Capacitor (Android/iOS) este problema no aplica · el
// WebView nativo no carga URLs https con ad-blockers de extension.

const DISMISS_KEY = 'btal_adblock_dismissed_at';
const RETRY_AFTER_DISMISS_MS = 60 * 60 * 1000; // 1h tras descartar

// Detecta si un error tiene la "firma" típica de bloqueo de Firestore
// por adblocker. Cubre los códigos y mensajes que la SDK de Firebase
// devuelve cuando la red está cortada por el cliente.
//
// Importante: si el navegador está offline (`navigator.onLine === false`),
// estos mismos códigos aparecen porque NO hay red en absoluto · no es
// el adblocker. En ese caso descartamos la detección · el OfflineBanner
// ya está informando al user del estado real.
function isFirestoreBlockedError(err: unknown): boolean {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const code = (err as { code?: string }).code;
  const message = String((err as { message?: string }).message ?? '');
  // 'unavailable' lo lanza Firestore tras N reintentos sin red.
  // 'permission-denied' NO es adblock (es rules) · lo excluimos.
  if (code === 'unavailable') return true;
  // Mensaje típico del fetch sin red disponible.
  if (message.includes('Failed to fetch')) return true;
  if (message.includes('NetworkError')) return true;
  if (message.includes('ERR_BLOCKED_BY_CLIENT')) return true;
  return false;
}

// En builds nativos (iOS/Android via Capacitor) el WebView no carga
// extensiones del navegador, así que los adblockers no pueden cortar
// Firestore. Saltamos el banner entero (sin listener, sin render).
const IS_NATIVE = Capacitor.isNativePlatform();

export function AdblockBanner() {
  // 'idle' = aún no hemos detectado nada (default).
  // 'blocked' = hubo al menos un error con firma de bloqueo.
  const [status, setStatus] = useState<'idle' | 'blocked'>('idle');

  useEffect(() => {
    if (IS_NATIVE) return; // no aplica en Capacitor nativo
    // Si el user descartó el banner hace menos de 1h, ignoramos la
    // detección durante ese rato.
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
      if (dismissedAt && Date.now() - dismissedAt < RETRY_AFTER_DISMISS_MS) {
        return; // listener no se monta
      }
    } catch {
      /* localStorage no disponible · seguimos */
    }

    // Listener pasivo · solo cataloga errores. No genera tráfico ni
    // afecta a la carga inicial.
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isFirestoreBlockedError(event.reason)) {
        setStatus('blocked');
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (IS_NATIVE) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode · best effort */
    }
    setStatus('idle');
  };

  if (status !== 'blocked') return null;

  return (
    <div
      className="adblock-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="adblock-banner-content">
        <strong>Conexión bloqueada</strong>
        <p>
          Algunos cambios no se están guardando. Si tienes un
          bloqueador de anuncios activo, desactívalo para{' '}
          <code>{PUBLIC_HOSTNAME}</code> y recarga.
        </p>
      </div>
      <button
        type="button"
        className="adblock-banner-dismiss"
        onClick={dismiss}
        aria-label="Ocultar aviso una hora"
      >
        ×
      </button>
    </div>
  );
}
