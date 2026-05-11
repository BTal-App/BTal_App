import { createContext } from 'react';

// Context global de feedback de errores · canal único para que cualquier
// hook/provider/componente notifique de un fallo al usuario sin tener
// que montar su propio toast. Implementación en `ErrorProvider.tsx`.
//
// Filosofía:
//   - Solo errores NO-RECUPERABLES desde el código (ya hubo revert
//     optimista o no se pudo evitar). Ejemplo típico: write a Firestore
//     que falla tras varios reintentos internos del SDK.
//   - El mensaje se enseña como toast rojo "color: danger" en la
//     posición bottom durante 3500ms · suficiente para leerlo sin
//     bloquear la UI.
//   - El user puede tener varios errores en fila · el provider los
//     encola y los muestra de uno en uno para no saturar.

export interface ErrorState {
  // Lanza un mensaje de error visible al usuario. El toast se muestra
  // automáticamente · no hace falta gestionar visibilidad desde el caller.
  showError: (message: string) => void;
}

export const ErrorContext = createContext<ErrorState | null>(null);
