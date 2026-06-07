// Feedback de pulsación FIABLE para tarjetas tappables.
//
// Problema: el pseudo-clase CSS `:active` NO es fiable en móvil dentro de una
// lista con scroll VERTICAL · el navegador retrasa/suprime `:active` mientras
// decide si el toque es un scroll o un tap, así que el "hundido" solo salía
// con una pulsación mantenida/fuerte. (Los chips `.plan-mini` van siempre
// porque viven en una fila de scroll HORIZONTAL, donde no hay esa ambigüedad.)
//
// Solución: delegación con eventos `pointer`. Al tocar una tarjeta le ponemos
// la clase `.is-pressed` (el CSS la hunde igual que `:active`); la quitamos al
// soltar, cancelar, o si el dedo se desplaza (= ha empezado un scroll). Así el
// hundido sale SIEMPRE, en cualquier toque por rápido que sea, sin depender de
// `:active`. `:active` se mantiene en CSS como fallback para ratón/escritorio.

// Cubre TODOS los elementos pulsables: botones (incluido ion-button vía
// retargeting del shadow DOM) y las tarjetas (algunas son <div>, no <button>).
// `:not(...disabled)` para no hundir botones deshabilitados.
const PRESS_SELECTOR = [
  'button:not([disabled])',
  'ion-button:not(.button-disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  '.hoy-meal-card',
  '.hoy-train-card',
  '.hoy-ai-status',
  '.menu-meal',
  '.train-day',
  '.plan-mini',
  '.compra-item',
  '.cal-day',
  '.reg-stat-card',
  '.menu-day-popover-item',
].join(',');

// Umbral de movimiento (px) a partir del cual consideramos que es un scroll y
// cancelamos el press · evita dejar la tarjeta hundida al deslizar la lista.
const MOVE_CANCEL_PX = 8;

let pressedEl: Element | null = null;
let startX = 0;
let startY = 0;

function release(): void {
  if (pressedEl) {
    pressedEl.classList.remove('is-pressed');
    pressedEl = null;
  }
}

let initialized = false;

export function initPressFeedback(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  document.addEventListener(
    'pointerdown',
    (e) => {
      const target = e.target as Element | null;
      const el = target?.closest?.(PRESS_SELECTOR) ?? null;
      release();
      if (el) {
        pressedEl = el;
        startX = e.clientX;
        startY = e.clientY;
        el.classList.add('is-pressed');
      }
    },
    { passive: true, capture: true },
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!pressedEl) return;
      if (
        Math.abs(e.clientX - startX) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - startY) > MOVE_CANCEL_PX
      ) {
        release();
      }
    },
    { passive: true, capture: true },
  );

  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    document.addEventListener(ev, release, { passive: true, capture: true });
  }
  // Cualquier scroll cancela el press en curso.
  document.addEventListener('scroll', release, { passive: true, capture: true });
}
