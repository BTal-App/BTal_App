import { useEffect, useRef, useState } from 'react';
import { IonToast } from '@ionic/react';
import './OfflineBanner.css';

// Banner persistente cuando el navegador detecta que no hay red.
//
// Por qué importa: Firestore en BTal NO tiene persistentLocalCache
// configurado (sin offline persistence). Eso significa que cualquier
// write hecho offline falla inmediatamente con code 'unavailable' · no
// se encola. El user perdería su acción sin saber por qué.
//
// El banner avisa antes de que descubra esto por una pulsación fallida.
// Al volver online el banner desaparece y un IonToast verde breve
// confirma la recuperación · cierra el feedback loop.
//
// Aplica también en Capacitor nativo (iOS/Android) · el WebView
// dispatcha 'online'/'offline' cuando el SO cambia el estado de red.
// No necesita guard de plataforma como AdblockBanner.

export function OfflineBanner() {
  // Estado inicial vía navigator.onLine · `true` en entornos sin
  // navigator (Vitest jsdom o SSR si algún día lo hubiera).
  const initialOnline = typeof navigator !== 'undefined'
    ? navigator.onLine
    : true;

  const [online, setOnline] = useState<boolean>(initialOnline);
  const [showRecovered, setShowRecovered] = useState<boolean>(false);

  // Ref para detectar transición offline→online sin closures stale en
  // los listeners (que se registran una sola vez con [] deps).
  const onlineRef = useRef<boolean>(initialOnline);

  useEffect(() => {
    const onOnline = () => {
      // Solo confirmamos recuperación si veníamos de offline.
      if (!onlineRef.current) {
        setShowRecovered(true);
      }
      onlineRef.current = true;
      setOnline(true);
    };
    const onOffline = () => {
      onlineRef.current = false;
      setOnline(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <>
      {!online && (
        <div
          className="offline-banner"
          role="alert"
          aria-live="polite"
        >
          <div className="offline-banner-content">
            <strong>Sin conexión</strong>
            <p>Reconecta para guardar tus cambios.</p>
          </div>
        </div>
      )}
      <IonToast
        isOpen={showRecovered}
        message="Conexión restablecida"
        duration={2000}
        position="top"
        color="success"
        onDidDismiss={() => setShowRecovered(false)}
      />
    </>
  );
}
