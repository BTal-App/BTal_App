import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  NavStyle,
  Preferences,
  RegistroCalPos,
  UnitsSystem,
  WeekStart,
} from '../utils/units';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useError } from './useError';
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

// Valida que un objeto desconocido tiene la forma de RegistroCalPos.
// Hace clamp: month0 ∈ [0,11], view ∈ {'month','week'}. Si algo está
// mal, devuelve null y el caller cae al default.
function parseRegistroCal(raw: unknown): RegistroCalPos | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RegistroCalPos>;
  const y = typeof r.year === 'number' ? r.year : NaN;
  const m = typeof r.month0 === 'number' ? r.month0 : NaN;
  const v = r.view === 'week' ? 'week' : r.view === 'month' ? 'month' : null;
  if (!Number.isFinite(y) || !Number.isFinite(m) || v === null) return null;
  if (m < 0 || m > 11) return null;
  return { year: y, month0: m, view: v };
}

// Normaliza el valor de `navStyle` leído de storage/Firestore al tipo
// actual `'labeled' | 'compact'`. Acepta legacy `'tiktok'` → `'labeled'`
// y `'ig'` → `'compact'`. Cualquier otra cosa cae al default `'labeled'`.
function normalizeNavStyle(raw: unknown): 'labeled' | 'compact' {
  if (raw === 'compact' || raw === 'ig') return 'compact';
  // 'labeled', 'tiktok', undefined, null, cualquier otro → default
  return 'labeled';
}

function loadFromLocal(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      units: parsed.units === 'imperial' ? 'imperial' : 'metric',
      weekStart: parsed.weekStart === 'sunday' ? 'sunday' : 'monday',
      registroCal: parseRegistroCal(parsed.registroCal),
      navStyle: normalizeNavStyle(parsed.navStyle),
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
  const { showError } = useError();
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
        // Le contamos al user que sus prefs viven solo en local hasta
        // el siguiente save exitoso · si la red estaba caída en este
        // primer load no se sincronizan con otros dispositivos hasta
        // que `setUnits`/`setWeekStart`/etc dispare otro write.
        showError(
          'No hemos podido sincronizar tus preferencias con la nube. '
          + 'Siguen funcionando en este dispositivo.',
        );
      });
    }
    // Si profile es null (no hay doc todavía — onboarding pendiente),
    // esperamos a que se cree y reentramos por aquí en el siguiente cambio.
    // setSyncedFor + setPrefs en el effect son sincronización con un
    // sistema externo (Firestore) — caso explícitamente permitido por la
    // doc de React. La regla de eslint no distingue, así que la silenciamos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncedFor(uid);
  }, [uid, isAnonymous, profile, profileLoading, syncedFor, showError]);

  // Aplica la clase del nav style al `<body>` según la preferencia
  // efectiva. Prioridad:
  //   1. Override de preview vía URL param (sessionStorage
  //      `btal-nav-preview`) · efímero por pestaña.
  //   2. Preferencia persistente (`prefs.navStyle` · localStorage +
  //      Firestore) · default `'labeled'`.
  // CSS bajo selectores `body.nav-labeled` y `body.nav-compact` en
  // `theme/variables.css`. Sin clase aplicada el AppShell quedaría
  // con el layout base (no deseado), por eso siempre garantizamos
  // UNA de las dos clases.
  //
  // Acepta valores legados (`'tiktok'`/`'ig'`) en sessionStorage para
  // que URLs antiguas compartidas (`?nav=tiktok`) sigan funcionando.
  useEffect(() => {
    const preview = (() => {
      try { return sessionStorage.getItem('btal-nav-preview'); }
      catch { return null; }
    })();
    const previewNorm =
      preview === 'tiktok' || preview === 'labeled' ? 'labeled'
      : preview === 'ig' || preview === 'compact' ? 'compact'
      : null;
    const effective: NavStyle =
      previewNorm ?? prefs.navStyle ?? 'labeled';
    document.body.classList.remove('nav-labeled', 'nav-compact');
    document.body.classList.add(
      effective === 'compact' ? 'nav-compact' : 'nav-labeled',
    );
  }, [prefs.navStyle]);

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
        // Fire-and-forget pero ya NO silencioso · si la escritura falla
        // mostramos toast rojo para que el user sepa que su elección no
        // se persistió (sigue en local, pero no se sincroniza con otros
        // dispositivos hasta el siguiente save exitoso).
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences error:', err);
          showError('No hemos podido guardar tus preferencias. Comprueba tu conexión.');
        });
        return next;
      });
    },
    [persist, showError],
  );

  const setWeekStart = useCallback(
    (weekStart: WeekStart) => {
      userTouchedRef.current = true;
      setPrefs((p) => {
        const next = { ...p, weekStart };
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences error:', err);
          showError('No hemos podido guardar tus preferencias. Comprueba tu conexión.');
        });
        return next;
      });
    },
    [persist, showError],
  );

  const setRegistroCal = useCallback(
    (pos: RegistroCalPos | null) => {
      userTouchedRef.current = true;
      setPrefs((p) => {
        const next: Preferences = { ...p, registroCal: pos };
        // Posición del calendar · cambios MUY frecuentes (cada
        // navegación) y de bajo impacto · si fallan lo logueamos pero
        // NO molestamos al user con un toast cada vez. La posición se
        // queda en local hasta el siguiente save exitoso.
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences (registroCal) error:', err);
        });
        return next;
      });
    },
    [persist],
  );

  const setNavStyle = useCallback(
    (navStyle: NavStyle) => {
      userTouchedRef.current = true;
      setPrefs((p) => {
        const next: Preferences = { ...p, navStyle };
        persist(next).catch((err) => {
          console.warn('[BTal] save preferences (navStyle) error:', err);
          showError('No hemos podido guardar el estilo del menú. Comprueba tu conexión.');
        });
        return next;
      });
      // Al elegir explícitamente desde Settings, descartamos cualquier
      // override de preview via URL param (`?nav=...`) que viviera en
      // sessionStorage · así el efecto en App.tsx aplica la preferencia
      // recién guardada inmediatamente.
      try {
        sessionStorage.removeItem('btal-nav-preview');
      } catch {
        /* private mode · best effort */
      }
    },
    [persist, showError],
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
      registroCal: prefs.registroCal ?? null,
      navStyle: prefs.navStyle ?? 'labeled',
      setUnits,
      setWeekStart,
      setRegistroCal,
      setNavStyle,
      setPreferences,
    }),
    [
      prefs.units,
      prefs.weekStart,
      prefs.registroCal,
      prefs.navStyle,
      setUnits,
      setWeekStart,
      setRegistroCal,
      setNavStyle,
      setPreferences,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
