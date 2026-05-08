// Helpers de gestión de foco.
//
// El warning "Blocked aria-hidden on an element because its descendant
// retained focus" lo provocan los IonModal e IonRouterOutlet de Ionic
// React: cuando abrimos un modal, Ionic pone aria-hidden="true" en el
// outlet de la página de fondo. Si el botón que abrió el modal todavía
// tiene foco al abrirse, queda enterrado bajo aria-hidden y los lectores
// de pantalla pierden el contexto.
//
// Particularidad de IonButton (y otros web components de Ionic):
// internamente renderizan `<a class="button-native">` (o `<button
// class="button-native">`). El foco lo retiene ESE elemento interno,
// no el host `<ion-button>`. Por eso `host.blur()` solo no basta:
// necesitamos también blur del button-native y del activeElement.

import type { MouseEvent, ReactEventHandler } from 'react';

// Hace blur en cascada de los elementos relevantes para garantizar que
// ningún descendiente del modal-de-fondo retenga foco al abrirse el
// nuevo modal. Es seguro llamarlo siempre — los blurs son no-ops si el
// elemento no tiene foco.
export function blurEverything(host: HTMLElement | null) {
  // 1) Blur del host element (button nativo, IonButton host, etc.)
  if (host && typeof host.blur === 'function') host.blur();

  // 2) Blur del elemento interno renderizado por web components de
  //    Ionic. `IonButton` → `a.button-native`. `IonItem` clickable →
  //    `button.item-native`. `IonInput` (no clickable pero por si
  //    acaso) → `input.native-input`. `querySelector` solo recorre
  //    light DOM; los web components de Ionic exponen estos elementos
  //    en shadow DOM y no son accesibles por querySelector. Para
  //    cubrir esos casos, abajo hacemos blur del activeElement global.
  if (host?.querySelector) {
    const inner = host.querySelector(
      '.button-native, .item-native, .native-input',
    ) as HTMLElement | null;
    inner?.blur?.();
  }

  // 3) Último recurso: blur del activeElement actual del documento.
  //    Cubre el caso del shadow DOM de IonButton y cualquier otro
  //    elemento que retenga foco fuera del subtree del host.
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && typeof active.blur === 'function') {
    active.blur();
  }
}

// Devuelve un handler que hace blur del elemento clicado y luego ejecuta
// `fn`. Pensado para `onClick` de buttons que abren modales o navegan.
export function blurAndRun<T extends Element = HTMLElement>(
  fn: () => void,
): ReactEventHandler<T> {
  return (e: { currentTarget: T } & Pick<MouseEvent<T>, 'preventDefault'>) => {
    blurEverything(e.currentTarget as unknown as HTMLElement);
    fn();
  };
}
