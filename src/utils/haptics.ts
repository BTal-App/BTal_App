// Feedback háptico (vibración sutil) para que los toques se sientan nativos.
// Solo en plataforma nativa (Capacitor) · en web es un no-op silencioso.
// Falla en silencio: un háptico nunca debe romper una interacción.
//
// Uso típico:
//   onClick={() => { hapticTap(); abrirAlgo(); }}
//   tras marcar algo como hecho: hapticSuccess();

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = (): boolean => Capacitor.isNativePlatform();

// Toque ligero · para abrir tarjetas, pulsar botones, seleccionar.
export function hapticTap(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
    /* no-op · el dispositivo puede no tener motor háptico */
  });
}

// Toque medio · para acciones con algo más de peso (confirmar, generar).
export function hapticMedium(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

// Notificación de éxito · para "marcar como hecho/tomado", guardar, completar.
export function hapticSuccess(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
