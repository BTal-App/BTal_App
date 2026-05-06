import { createContext } from 'react';
import type { UnitsSystem, WeekStart } from '../utils/units';

export interface Preferences {
  // 'metric' (kg, cm) o 'imperial' (lb, in)
  units: UnitsSystem;
  // Día con el que arranca la semana en calendarios / planes
  weekStart: WeekStart;
}

export const DEFAULT_PREFERENCES: Preferences = {
  units: 'metric',
  weekStart: 'monday',
};

export interface PreferencesState extends Preferences {
  setUnits: (u: UnitsSystem) => void;
  setWeekStart: (w: WeekStart) => void;
}

export const PreferencesContext = createContext<PreferencesState | null>(null);
