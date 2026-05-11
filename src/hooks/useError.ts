import { useContext } from 'react';
import { ErrorContext, type ErrorState } from './error-context';

// Hook acceso al canal global de errores · uso típico en catch blocks:
//
//   const { showError } = useError();
//   try {
//     await someFirestoreOp();
//   } catch (err) {
//     console.error('[Mi flujo]', err);
//     showError('No hemos podido guardar. Inténtalo de nuevo.');
//   }
//
// Si el hook se llama fuera del Provider devuelve una versión no-op para
// que no rompa builds aislados / tests. En producción siempre estará el
// Provider en App.tsx envolviendo el árbol.
export function useError(): ErrorState {
  const ctx = useContext(ErrorContext);
  if (!ctx) {
    return { showError: () => { /* no-op fuera del Provider */ } };
  }
  return ctx;
}
