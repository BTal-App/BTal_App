import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Preferences, UnitsSystem, WeekStart } from '../utils/units';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { setUserPreferences } from '../services/db';
import {
  DEFAULT_PREFERENCES,
  PreferencesContext,
  type PreferencesState,
} from './preferences-context';

// Estrategia de almacenamiento:
// - Invitado (anónimo): SOLO localStorage. Sin Firestore, sin sync.
// - Usuario real: localStorage como caché rápida + Firestore como fuente
//   de verdad para sync cross-device.
//
// Migración invitado → real:
// Cuando un anónimo enlaza email/Google y se convierte en real, su
// localStorage tiene sus prefs. La primera vez que cargamos su perfil de
// Firestore, si NO hay preferences guardadas allí, copiamos las locales
// arriba. Así sus elecciones (Imperial, Domingo) viajan con él.
const STORAGE_KEY = 'btal_preferences';

function loadFromLocal(): Preferences {
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

function saveToLocal(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / disabled — best effort */
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const uid = user?.uid ?? null;
  const isAnonymous = user?.isAnonymous ?? false;

  // Lazy init desde localStorage. Para un user real, esto puede sobrescribirse
  // tras el sync con Firestore.
  const [prefs, setPrefs] = useState<Preferences>(loadFromLocal);

  // Track del UID con el que ya hemos sincronizado para no entrar en bucles
  // ni re-sobrescribir cuando el usuario cambia las prefs después.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  // Reset del syncedFor al cambiar de usuario (state-from-prop, sin effect).
  const userKey = isAnonymous ? null : uid;
  if (syncedFor !== null && syncedFor !== userKey) {
    setSyncedFor(null);
  }

  // Sync / migración Firestore. Solo aplica a usuarios reales (no anónimos)
  // y se ejecuta una vez por uid. Casos cubiertos:
  //  · Login fresco con prefs guardadas → adoptamos las de Firestore.
  //  · Primer login real (o anónimo→real) sin prefs en Firestore →
  //    pusheamos las locales arriba.
  useEffect(() => {
    if (!uid || isAnonymous) return;
    if (syncedFor === uid) return;
    if (profileLoading) return;

    if (profile?.preferences) {
      // Firestore manda — actualizamos local + state.
      const remote = profile.preferences;
      saveToLocal(remote);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(remote);
    } else if (profile) {
      // Profile existe pero sin preferences → migramos las locales.
      // Aquí el doc seguro que existe (lo acabamos de leer), updateDoc OK.
      setUserPreferences(uid, prefs).catch((err) => {
        console.warn('[BTal] migrate preferences error:', err);
      });
    }
    // Si profile es null (no hay doc todavía — onboarding pendiente),
    // esperamos a que se cree y reentramos por aquí en el siguiente cambio.
    setSyncedFor(uid);
  }, [uid, isAnonymous, profile, profileLoading, syncedFor, prefs]);

  const persist = useCallback(
    (next: Preferences) => {
      saveToLocal(next);
      if (uid && !isAnonymous) {
        setUserPreferences(uid, next).catch((err) => {
          // 'not-found' = el doc del usuario aún no existe (todavía no ha
          // pasado por onboarding). No es crítico — las prefs quedan en
          // local y se sincronizan cuando se cree el doc tras onboarding.
          const code = (err as { code?: string })?.code;
          if (code === 'not-found') return;
          console.warn('[BTal] save preferences error:', err);
        });
      }
    },
    [uid, isAnonymous],
  );

  const setUnits = useCallback(
    (units: UnitsSystem) => {
      setPrefs((p) => {
        const next = { ...p, units };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setWeekStart = useCallback(
    (weekStart: WeekStart) => {
      setPrefs((p) => {
        const next = { ...p, weekStart };
        persist(next);
        return next;
      });
    },
    [persist],
  );

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
