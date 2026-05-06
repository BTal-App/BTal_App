import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { consumePendingRedirect } from '../services/auth';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Si Firebase ya restauró la sesión antes del primer render, evitamos el flash
  // de spinner inicial.
  const initialUser = auth.currentUser;
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(initialUser === null);
  // `version` solo existe para forzar re-renders cuando los consumidores
  // llaman a refreshUser tras una mutación que Firebase no nos notifica
  // (ej. applyActionCode cambia user.email pero no dispara onAuthStateChanged).
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Recoge resultado pendiente de signInWithRedirect (Google en PWA standalone).
    // No pasa nada si no hay nada que consumir; los errores reales los muestra
    // Landing tras el redirect.
    consumePendingRedirect().catch((err) => {
      console.warn('[BTal] redirect result error:', err);
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.reload();
    } catch (err) {
      console.warn('[BTal] refreshUser reload error:', err);
    }
    // Bumpeamos version para que value sea un objeto nuevo y los consumidores
    // re-rendericen; user es la misma referencia mutada.
    setVersion((v) => v + 1);
  }, []);

  const value: AuthState = { user, loading, isAuthed: !!user, refreshUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
