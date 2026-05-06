import { createContext } from 'react';
import type { Preferences, UnitsSystem, WeekStart } from '../utils/units';

// Re-export por comodidad para los consumidores del hook.
export type { Preferences } from '../utils/units';
export { DEFAULT_PREFERENCES } from '../utils/units';

export interface PreferencesState extends Preferences {
  setUnits: (u: UnitsSystem) => void;
  setWeekStart: (w: WeekStart) => void;
}

export const PreferencesContext = createContext<PreferencesState | null>(null);
