import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveStatus } from '../components/SaveIndicator';

// "Guardado ✓" visible 500 ms · medio segundo es perceptible sin
// sentirse lento. El optimistic update del provider ya aplicó el
// cambio en la UI antes incluso de que Firestore confirme, así que
// este valor es puramente estético (flash del check antes de cerrar).
const SAVED_VISIBLE_MS = 500;
const ERROR_VISIBLE_MS = 3000;

// Sentinel devuelto por runSave cuando la operación lanzó. Usamos un
// Symbol y NO `undefined` porque las funciones de Firestore resuelven
// como `Promise<void>` (return implícito undefined): si fuese undefined
// el sentinel, no podríamos distinguir "guardó OK pero la fn no devuelve
// valor" de "falló". Con el símbolo, la comparación `=== SAVE_FAILED`
// es inequívoca incluso para funciones void.
export const SAVE_FAILED = Symbol('SAVE_FAILED');
export type SaveFailedSignal = typeof SAVE_FAILED;

export interface UseSaveStatusResult {
  status: SaveStatus;
  // Ejecuta `fn` envuelta en el ciclo saving → saved/error → idle.
  // Devuelve el valor de `fn` si fue OK, o el sentinel SAVE_FAILED si
  // lanzó. La duración de "saving" es exactamente la que tarda `fn` (la
  // promesa de Firestore) — sin simulaciones, sincronizado con la red real.
  runSave: <T = void>(
    fn: () => Promise<T>,
  ) => Promise<T | SaveFailedSignal>;
  // Resetea el indicador a 'idle' inmediatamente (útil al cerrar el modal
  // si quieres que la próxima apertura arranque limpia).
  reset: () => void;
}

// Hook que encapsula el patrón "guardar a Firestore con feedback visual".
// Cualquier modal con botón Guardar lo usa así:
//
//   const { status, runSave } = useSaveStatus();
//   const handleSave = async () => {
//     const result = await runSave(() => updateDoc(...));
//     if (result === SAVE_FAILED) return; // ya hay chip "Error" 3s
//     // éxito · esperamos a que el usuario vea "Guardado" antes de cerrar
//     setTimeout(onClose, SAVED_VISIBLE_MS);
//   };
//
//   <SaveIndicator status={status} />
//   <IonButton onClick={handleSave} disabled={status === 'saving'}>Guardar</IonButton>
export function useSaveStatus(): UseSaveStatusResult {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track de montaje · evita setState después de unmount cuando la
  // promise de Firestore resuelve más tarde de que el modal se cierre.
  // React 19 emite warning sin esto y a veces deja status colgado.
  const mounted = useRef(true);

  // Cleanup timer + flag al desmontar.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (mounted.current) setStatus('idle');
  }, []);

  const runSave = useCallback(
    async <T = void>(
      fn: () => Promise<T>,
    ): Promise<T | SaveFailedSignal> => {
      // Cancelamos cualquier "vuelta a idle" pendiente y arrancamos saving.
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (mounted.current) setStatus('saving');
      try {
        const result = await fn();
        if (!mounted.current) return result;
        setStatus('saved');
        idleTimer.current = setTimeout(() => {
          if (mounted.current) setStatus('idle');
        }, SAVED_VISIBLE_MS);
        return result;
      } catch (err) {
        console.error('[BTal] save error:', err);
        if (!mounted.current) return SAVE_FAILED;
        setStatus('error');
        idleTimer.current = setTimeout(() => {
          if (mounted.current) setStatus('idle');
        }, ERROR_VISIBLE_MS);
        return SAVE_FAILED;
      }
    },
    [],
  );

  return { status, runSave, reset };
}

// Tiempo que el indicador "Guardado" permanece visible tras éxito · exporto
// para que los callers (que esperen a cerrar el modal) usen el mismo valor.
export const SAVED_INDICATOR_MS = SAVED_VISIBLE_MS;
