import { useCallback, useState, type ReactNode } from 'react';
import type { UnitsSystem, WeekStart } from '../utils/units';
import {
  DEFAULT_PREFERENCES,
  PreferencesContext,
  type Preferences,
  type PreferencesState,
} from './preferences-context';

// Persiste las preferencias en localStorage (por dispositivo). Cuando el
// usuario tenga Firestore activo y queramos sync cross-device, se puede
// mover el storage a /users/{uid}/profile sin tocar consumidores.
const STORAGE_KEY = 'btal_preferences';

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      units: parsed.units === 'imperial' ? 'imperial' : 'metric',
      weekStart: parsed.weekStart === 'sunday' ? 'sunday' : 'monday',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / disabled / etc. — fallback en memoria */
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Lazy init: leemos localStorage solo en el primer render.
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  const setUnits = useCallback((units: UnitsSystem) => {
    setPrefs((p) => {
      const next = { ...p, units };
      savePreferences(next);
      return next;
    });
  }, []);

  const setWeekStart = useCallback((weekStart: WeekStart) => {
    setPrefs((p) => {
      const next = { ...p, weekStart };
      savePreferences(next);
      return next;
    });
  }, []);

  const value: PreferencesState = {
    units: prefs.units,
    weekStart: prefs.weekStart,
    setUnits,
    setWeekStart,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
