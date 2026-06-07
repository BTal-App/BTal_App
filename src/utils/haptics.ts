// Feedback háptico (vibración sutil) para que los toques se sientan nativos.
// Solo en plataforma nativa (Capacitor) · en web es un no-op silencioso.
// Falla en silencio: un háptico nunca debe romper una interacción.
//
// Uso típico:
//   onClick={() => { hapticTap(); abrirAlgo(); }}

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Flag sincronizado desde PreferencesProvider · el háptico está DESACTIVADO
// por defecto; el user lo activa en Ajustes → Preferencias. El util es una
// función suelta (sin acceso a React), así que el provider empuja aquí el
// valor actual via setHapticsEnabled cada vez que cambia/carga.
let hapticsEnabled = false;
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}

const active = (): boolean => hapticsEnabled && Capacitor.isNativePlatform();

// Toque ligero · para abrir tarjetas, pulsar botones, seleccionar.
export function hapticTap(): void {
  if (!active()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
    /* no-op · el dispositivo puede no tener motor háptico */
  });
}
