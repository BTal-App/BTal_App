import { useEffect, useMemo, useRef, useState } from 'react';

// Hook que interpola un número de su valor actual a `target` con
// easing easeOutCubic durante `durationMs` ms. Réplica del v1
// `animateNumber()` (line 2497 del index.html monolítico) usado en
// la macro-overview de la media semanal.
//
// Uso:
//   const kcal = useCountUp(avg.kcal, { duration: 600, enabled: visible });
//   <span>{kcal}</span>
//
// - Cuando `target` cambia: anima desde el valor actual al nuevo target.
// - Si `enabled === false`: devuelve `initial` (típicamente 0) sin
//   animar · cuando pase a true arranca animación 0 → target.
//   Importante: NO devolvemos target porque entonces al hacerse
//   visible se vería un "salto" target → 0 → target.
// - `prefers-reduced-motion: reduce` desactiva la animación · siempre
//   devuelve target (sin saltos posibles porque no hay frames).
// - Devuelve un entero redondeado · matchea el comportamiento del v1.

interface UseCountUpOptions {
  // Duración de la animación en ms · default 600.
  duration?: number;
  // Si `false`, el hook devuelve el target sin animar (sirve para
  // esperar a que el componente sea visible antes de arrancar).
  // Default `true`.
  enabled?: boolean;
  // Valor inicial al primer render · default 0 (la animación sube
  // desde 0 hasta el target la primera vez).
  initial?: number;
}

export function useCountUp(
  target: number,
  { duration = 600, enabled = true, initial = 0 }: UseCountUpOptions = {},
): number {
  // Detección de prefers-reduced-motion · una sola vez por componente.
  // Si el sistema lo pide, saltamos la animación devolviendo target.
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // State interno · empieza en `initial` (típicamente 0). Cuando
  // `enabled` pasa a true, el efecto arranca rAF y va subiendo hasta
  // target. Cuando `reducedMotion`, devolvemos target sin animar.
  const [animatedValue, setAnimatedValue] = useState<number>(initial);
  // Ref con el último valor pintado · permite que rAF interpole desde
  // el valor real cuando el target cambia a mitad de animación. La
  // actualización va en su propio useEffect (post-render) para
  // cumplir la regla `react-hooks/refs` (no escribir refs en render).
  const valueRef = useRef<number>(initial);
  useEffect(() => {
    valueRef.current = animatedValue;
  }, [animatedValue]);

  useEffect(() => {
    if (reducedMotion) return; // se devuelve target abajo, sin estado
    if (!enabled) return; // esperamos a que `enabled` pase a true
    const from = valueRef.current;
    if (from === target) return;
    const startTs = performance.now();
    let rafId = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - startTs) / duration);
      // easeOutCubic · misma curva que el v1 animateNumber.
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (target - from) * eased);
      // setState async vía requestAnimationFrame · no choca con la
      // regla react-hooks/set-state-in-effect.
      setAnimatedValue(next);
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled, reducedMotion]);

  // Reduced motion · saltamos animación, devolvemos target directo.
  // Caso normal · devolvemos animatedValue (sube de initial → target
  // cuando `enabled` pasa a true).
  return reducedMotion ? target : animatedValue;
}

// Hook auxiliar · detecta cuándo un elemento entra por primera vez en
// viewport. Devuelve un boolean que pasa de false a true (y nunca
// vuelve a false) la primera vez que el ref se vuelve visible.
// Útil para arrancar count-up animations al hacer scroll.
export function useFirstVisible(
  ref: React.RefObject<HTMLElement | null>,
  threshold: number = 0.3,
): boolean {
  // Lazy init: si IntersectionObserver no existe (entornos viejos /
  // tests), arrancamos directamente como visible. Inicializador
  // función → no tocamos setState en el effect, regla `set-state-
  // in-effect` queda contenta.
  const [visible, setVisible] = useState<boolean>(
    () => typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (visible) return; // ya disparado · no re-suscribimos
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return; // ya cubierto en init
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // setState dentro de callback async · permitido por la
            // regla react-hooks/set-state-in-effect.
            setVisible(true);
            observer.disconnect();
            return;
          }
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, visible]);

  return visible;
}
