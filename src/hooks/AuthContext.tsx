import { useEffect, useState, type ReactNode } from 'react';
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

  const value: AuthState = { user, loading, isAuthed: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
