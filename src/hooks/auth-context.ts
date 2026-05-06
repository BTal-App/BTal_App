import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthed: boolean;
  // Refresca los campos del usuario desde el servidor (email, emailVerified,
  // providerData, metadata, photoURL, displayName) y fuerza re-render de los
  // consumidores. Útil tras applyActionCode (verify/change email) o cuando
  // sospechamos que el user del cliente está desfasado respecto al servidor.
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
