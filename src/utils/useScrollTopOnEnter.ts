import type { RefObject } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

// Hook que devuelve el scroll de un IonContent al inicio cada vez que
// la tab se vuelve activa. Usa `useIonViewWillEnter` (Ionic) que se
// dispara antes de que la vista termine de presentarse, así el cambio
// es invisible al usuario (no se ve "salto" desde la posición previa).
//
// Uso:
//   const contentRef = useRef<HTMLIonContentElement>(null);
//   useScrollTopOnEnter(contentRef);
//   return <IonContent ref={contentRef} fullscreen>...</IonContent>;
//
// Llamamos `scrollToTop(0)` con duración 0 (sin animación) — la
// transición de tab ya gestiona la animación visual; un scroll
// animado encima sumaría ruido.
export function useScrollTopOnEnter(
  contentRef: RefObject<HTMLIonContentElement | null>,
) {
  useIonViewWillEnter(() => {
    contentRef.current?.scrollToTop(0);
  });
}
