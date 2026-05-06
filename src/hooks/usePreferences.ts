import { useContext } from 'react';
import { PreferencesContext, type PreferencesState } from './preferences-context';

export function usePreferences(): PreferencesState {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within <PreferencesProvider>');
  return ctx;
}

export type { PreferencesState };
