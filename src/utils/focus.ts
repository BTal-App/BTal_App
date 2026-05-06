// Helpers de gestión de foco.
//
// El warning "Blocked aria-hidden on an element because its descendant
// retained focus" lo provocan los IonModal e IonRouterOutlet de Ionic
// React: cuando abrimos un modal, Ionic pone aria-hidden="true" en el
// outlet de la página de fondo. Si el botón que abrió el modal todavía
// tiene foco al abrirse, queda enterrado bajo aria-hidden y los lectores
// de pantalla pierden el contexto.
//
// La solución es hacer blur() del botón antes de abrir el modal. Este
// helper lo automatiza para no tener que recordar `e.currentTarget.blur()`
// en cada onClick.

import type { MouseEvent, ReactEventHandler } from 'react';

// Devuelve un handler que hace blur del elemento clicado y luego ejecuta
// `fn`. Pensado para `onClick` de buttons que abren modales o navegan.
export function blurAndRun<T extends Element = HTMLElement>(
  fn: () => void,
): ReactEventHandler<T> {
  return (e: { currentTarget: T } & Pick<MouseEvent<T>, 'preventDefault'>) => {
    const target = e.currentTarget as unknown as HTMLElement;
    if (target && typeof target.blur === 'function') {
      target.blur();
    }
    fn();
  };
}
