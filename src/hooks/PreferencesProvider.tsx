import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  // tras el sync con Firestore — pero solo si el user no ha tocado las prefs
  // antes de que llegue el doc remoto (ver `userTouchedRef`).
  const [prefs, setPrefs] = useState<Preferences>(loadFromLocal);

  // Track del UID con el que ya hemos sincronizado para no entrar en bucles
  // ni re-sobrescribir cuando el usuario cambia las prefs después.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  // Refs sin re-render:
  //   - prefsRef: para que el effect de sync use SIEMPRE las prefs actuales
  //     al pushear a Firestore, sin tener `prefs` en deps (lo que provocaba
  //     re-corridas spurias del effect cuando el user cambia algo).
  //   - userTouchedRef: si el usuario tocó setUnits/setWeekStart/setPreferences
  //     ANTES de que profile.preferences llegue de Firestore, NO pisamos su
  //     elección con la remota — gana lo que el user hizo.
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  const userTouchedRef = useRef(false);

  // Reset del syncedFor al cambiar de usuario (state-from-prop, sin effect).
  // El reset de userTouchedRef se hace en un effect aparte porque mutar refs
  // durante render está prohibido por React 19 / react-hooks/refs.
  const userKey = isAnonymous ? null : uid;
  if (syncedFor !== null && syncedFor !== userKey) {
    setSyncedFor(null);
  }
  useEffect(() => {
    // Cuando cambia el usuario, el flag "ha tocado prefs" se reinicia
    // para que el siguiente login pueda adoptar las prefs remotas.
    userTouchedRef.current = false;
  }, [userKey]);

  // Sync / migración Firestore. Solo aplica a usuarios reales (no anónimos)
  // y se ejecuta una vez por uid. Casos cubiertos:
  //  · Login fresco con prefs en Firestore → adoptamos las remotas (a menos
  //    que el user haya tocado algo en el ínterin: en ese caso pusheamos
  //    sus cambios a Firestore en lugar de adoptar las viejas).
  //  · Primer login real (o anónimo→real) sin prefs en Firestore →
  //    pusheamos las locales arriba.
  useEffect(() => {
    if (!uid || isAnonymous) return;
    if (syncedFor === uid) return;
    if (profileLoading) return;

    const userTouched = userTouchedRef.current;

    if (profile?.preferences && !userTouched) {
      // Firestore manda · adoptamos las prefs remotas.
      const remote = profile.preferences;
      saveToLocal(remote);
      setPrefs(remote);
    } else if (profile) {
      // Una de dos:
      //  - profile existe pero sin preferences → migración local→remota
      //  - profile.preferences existe pero el user ya cambió algo durante
      //    la carga → respeta su elección y la sube a Firestore
      // Usamos prefsRef para no depender de `prefs` en las deps del effect.
      setUserPreferences(uid, prefsRef.current).catch((err) => {
        console.warn('[BTal] migrate preferences error:', err);
      });
    }
    // Si profile es null (no hay doc todavía — onboarding pendiente),
    // esperamos a que se cree y reentramos por aquí en el siguiente cambio.
    // setSyncedFor + setPrefs en el effect son sincronización con un
    // sistema externo (Firestore) — caso explícitamente permitido por la
    // doc de React. La regla de eslint no distingue, así que la silenciamos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncedFor(uid);
  }, [uid, isAnonymous, profile, profileLoading, syncedFor]);

  // Devuelve la Promise del write a Firestore para que setPreferences
  // pueda awaitarla y exponer la duración real al caller (SaveIndicator).
  // 'not-found' (doc del user aún no existe) NO se considera error · las
  // prefs viven en local hasta que el onboarding cree el doc.
  const persist = useCallback(
    async (next: Preferences): Promise<void> => {
      saveToLocal(next);
      if (!uid || isAnonymous) return;
      try {
        await setUserPreferences(uid, next);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'not-found') return;
        throw err;
      }
    },
    [uid, isAnonymous],
  );

  const setUnits = useCallback(
    (units: UnitsSystem) => {
      userTouchedRef.current = true;
      setPrefs((p) => {
        const next = { ...p, units };
        // Fire-and-forget · el caller no espera feedback visual aquí.
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences error:', err);
        });
        return next;
      });
    },
    [persist],
  );

  const setWeekStart = useCallback(
    (weekStart: WeekStart) => {
      userTouchedRef.current = true;
      setPrefs((p) => {
        const next = { ...p, weekStart };
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences error:', err);
        });
        return next;
      });
    },
    [persist],
  );

  // Guarda varias prefs de golpe (un único write a Firestore). Devuelve
  // la Promise para que PreferencesModal pueda mostrar SaveIndicator
  // sincronizado con la duración real de Firestore.
  const setPreferences = useCallback(
    async (next: Preferences): Promise<void> => {
      userTouchedRef.current = true;
      setPrefs(next);
      await persist(next);
    },
    [persist],
  );

  // Memoizamos · evita re-renders del árbol consumidor cuando el
  // Provider se re-renderiza por causas no-relevantes (uid cambió,
  // ProfileProvider arriba se re-renderizó, etc.).
  const value = useMemo<PreferencesState>(
    () => ({
      units: prefs.units,
      weekStart: prefs.weekStart,
      setUnits,
      setWeekStart,
      setPreferences,
    }),
    [prefs.units, prefs.weekStart, setUnits, setWeekStart, setPreferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
