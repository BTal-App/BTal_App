import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { IonToast } from '@ionic/react';
import { ErrorContext, type ErrorState } from './error-context';

// ErrorProvider · canal único de feedback de errores al usuario.
//
// API mínima: `useError().showError(msg)`. El provider gestiona la cola
// internamente · si llegan varios errores casi a la vez se muestran en
// orden, uno detrás de otro, sin solaparse.
//
// El toast vive a nivel de App (root del provider tree) para que
// cualquier hijo pueda dispararlo. Usa `IonToast` color="danger" (rojo
// del tema BTal) y position="bottom" como el resto de toasts de la app.

export function ErrorProvider({ children }: { children: ReactNode }) {
  // Cola de mensajes pendientes · solo mostramos el [0] · al cerrarse,
  // el siguiente pasa al frente. Si no hay ninguno, el IonToast no se
  // renderiza (isOpen=false).
  const [queue, setQueue] = useState<string[]>([]);

  // Anti-duplicados rápidos · si el mismo error se dispara dos veces en
  // menos de 500ms (race entre dos hooks que comparten provider), el
  // segundo se ignora · el user no necesita ver el mismo toast dos veces.
  const lastErrorRef = useRef<{ msg: string; at: number } | null>(null);

  const showError = useCallback((message: string) => {
    if (!message) return;
    const now = Date.now();
    const last = lastErrorRef.current;
    if (last && last.msg === message && now - last.at < 500) return;
    lastErrorRef.current = { msg: message, at: now };
    setQueue((q) => [...q, message]);
  }, []);

  const value = useMemo<ErrorState>(() => ({ showError }), [showError]);

  const current = queue[0] ?? null;

  return (
    <ErrorContext.Provider value={value}>
      {children}
      <IonToast
        isOpen={current !== null}
        message={current ?? ''}
        duration={3500}
        position="bottom"
        color="danger"
        onDidDismiss={() => {
          // Pop del frente · el siguiente (si existe) pasa a mostrarse.
          setQueue((q) => q.slice(1));
        }}
      />
    </ErrorContext.Provider>
  );
}
