import { createContext } from 'react';
import type { NavStyle, Preferences, RegistroCalPos, UnitsSystem, WeekStart } from '../utils/units';

// Re-export por comodidad para los consumidores del hook.
export type { Preferences } from '../utils/units';
export { DEFAULT_PREFERENCES } from '../utils/units';

export interface PreferencesState extends Preferences {
  setUnits: (u: UnitsSystem) => void;
  setWeekStart: (w: WeekStart) => void;
  // Guarda la posición del calendar de Registro · null para borrar la
  // preferencia (siguiente entrada arrancará en mes/año actual).
  setRegistroCal: (pos: RegistroCalPos | null) => void;
  // Estilo del nav inferior · 'labeled' (default) o 'compact'.
  setNavStyle: (s: NavStyle) => void;
  // Guarda varias preferencias en una sola operación (un único write a
  // Firestore en vez de uno por campo). Devuelve la Promise del write
  // para que el caller pueda mostrar SaveIndicator sincronizado con la
  // duración real de Firestore (PreferencesModal lo usa).
  setPreferences: (next: Preferences) => Promise<void>;
}

export const PreferencesContext = createContext<PreferencesState | null>(null);
