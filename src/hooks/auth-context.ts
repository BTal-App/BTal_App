import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthed: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);
