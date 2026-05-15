import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  clearUserMeal,
  deleteUserPlanEntreno,
  duplicateUserMeal,
  duplicateUserMealExtras,
  ensureUserDocumentSchema,
  getUserDocument,
  patchSuplementos,
  saveOnboardingProfile,
  seedGuestDocument,
  setBatidoConfig as setBatidoConfigDb,
  setCreatinaConfig as setCreatinaConfigDb,
  setSupOverride as setSupOverrideDb,
  setSupStockGramos as setSupStockGramosDb,
  setUserActivePlan,
  setUserCompra,
  setUserCompraCategorias,
  setUserCompraItemsOfCategoria,
  setUserDayComidas,
  setUserDiaEntreno,
  setUserMealExtras,
  setUserMenuFlags,
  setUserPlanEntreno,
  toggleSupInDay as toggleSupInDayDb,
  touchLastActive,
  updateUserMeal,
  updateUserProfileFields,
} from '../services/db';
import {
  isoWeekKey,
  monthKey,
  todayDateStr,
  yearKey,
} from '../utils/dateKeys';
import {
  COMPRA_BUILTIN_IDS,
  HORA_DEFECTO,
  MAX_EXTRAS_POR_DIA,
  calcBatidoStats,
  calcCreatinaStats,
  defaultCompra,
  defaultMenu,
  defaultMenuFlags,
  newExtraId,
  type BatidoConfig,
  type CategoriaCompra,
  type Comida,
  type ComidaExtra,
  type ComidasDelDia,
  type Compra,
  type CreatinaConfig,
  type DayKey,
  type DiaEntreno,
  type Entrenos,
  type ItemCompra,
  type MealKey,
  type PlanEntreno,
  type SupDayOverride,
  type UserDocument,
  type UserProfile,
} from '../templates/defaultUser';
import { defaultDemoMenuForDay } from '../templates/demoUser';
import { applySupHistoryDelta } from '../utils/supHistory';
import { ProfileContext, type ProfileState } from './profile-context';

// Auto-reset de los contadores semanal/mensual de creatina si las marcas
// de inicio caen en una semana/mes anterior al actual. Réplica del v1
// (`renderSupl` consultaba CREATINA_WEEK_KEY / CREATINA_MONTH_KEY).
//
// Devuelve el doc actualizado · si no había nada que resetear, devuelve
// el doc tal cual (no escribe). Si sí, hace una sola escritura atómica
// con los campos cambiados y actualiza el state.
async function maybeResetSupCounters(
  uid: string,
  doc: UserDocument,
): Promise<UserDocument> {
  const sup = doc.suplementos;
  const now = Date.now();
  const wkActual = isoWeekKey();
  const moActual = monthKey();
  const yrActual = yearKey();

  const updates: Record<string, unknown> = {};
  let changed = false;

  // Helpers locales · evitan repetir el patrón.
  const checkPeriod = (
    inicio: number | null,
    contador: number,
    counterField: string,
    inicioField: string,
    actualKey: string,
    keyOf: (d: Date) => string,
  ) => {
    if (inicio === null) return;
    const marcaKey = keyOf(new Date(inicio));
    if (marcaKey !== actualKey && contador > 0) {
      updates[counterField] = 0;
      updates[inicioField] = now;
      changed = true;
    }
  };
  const checkWeek = (
    inicio: number | null,
    contador: number,
    counterField: string,
    inicioField: string,
  ) =>
    checkPeriod(inicio, contador, counterField, inicioField, wkActual, isoWeekKey);
  const checkMonth = (
    inicio: number | null,
    contador: number,
    counterField: string,
    inicioField: string,
  ) =>
    checkPeriod(inicio, contador, counterField, inicioField, moActual, monthKey);
  const checkYear = (
    inicio: number | null,
    contador: number,
    counterField: string,
    inicioField: string,
  ) =>
    checkPeriod(inicio, contador, counterField, inicioField, yrActual, yearKey);

  // Batido (Sub-fase 2B.5.b extension).
  checkWeek(
    sup.batido_semana_inicio,
    sup.batidos_tomados_semana,
    'batidos_tomados_semana',
    'batido_semana_inicio',
  );
  checkMonth(
    sup.batido_mes_inicio,
    sup.batidos_tomados_mes,
    'batidos_tomados_mes',
    'batido_mes_inicio',
  );
  checkYear(
    sup.batido_anio_inicio,
    sup.batidos_tomados_anio,
    'batidos_tomados_anio',
    'batido_anio_inicio',
  );
  // Creatina · igual lógica.
  checkWeek(
    sup.creatina_semana_inicio,
    sup.creatinas_tomadas_semana,
    'creatinas_tomadas_semana',
    'creatina_semana_inicio',
  );
  checkMonth(
    sup.creatina_mes_inicio,
    sup.creatinas_tomadas_mes,
    'creatinas_tomadas_mes',
    'creatina_mes_inicio',
  );
  checkYear(
    sup.creatina_anio_inicio,
    sup.creatinas_tomadas_anio,
    'creatinas_tomadas_anio',
    'creatina_anio_inicio',
  );

  if (!changed) return doc;
  await patchSuplementos(uid, updates);
  return {
    ...doc,
    suplementos: { ...sup, ...updates } as UserDocument['suplementos'],
    lastActive: now,
  };
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Rechaza si la promesa no resuelve en `ms`. Necesario porque el primer
// getDoc tras signInAnonymously puede QUEDARSE COLGADO (no rechaza) en
// WebView móvil mientras el token de App Check se propaga · sin esto el
// invitado se quedaba en "cargando…" hasta refrescar la página a mano.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout tras ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Carga el documento /users/{uid} cuando hay sesión y lo expone al árbol.
// Componentes consumidores: AppShell (decide si redirige a /onboarding),
// HoyPage/MenuPage/etc (leen menú, entrenos, compra), Onboarding (escribe
// profile completo).
//
// Desde Fase 2A los invitados también tienen un doc en Firestore, sembrado
// con `demoUser` cuando pulsan "Probar sin cuenta" en Landing. Así pueden
// ver un plan de ejemplo navegable desde el primer segundo, en vez de
// empty states que no dejan entender la app.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const isAnonymous = user?.isAnonymous ?? false;

  const [profile, setProfile] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Reset síncrono cuando cambia el usuario ────────────────────────────
  // Si esperamos al useEffect, hay un render intermedio donde:
  //   loading=false (del user anterior), profile=null, user=nuevoUser
  // El shell ve eso y redirige a /onboarding aunque el user sí tenga su
  // perfil completo en Firestore — solo que aún no lo hemos cargado.
  // Resetando durante render con state-from-prop garantizamos que el
  // primer render ya muestra loading=true y nadie redirige por error.
  const [trackedUid, setTrackedUid] = useState<string | null>(uid);
  if (trackedUid !== uid) {
    setTrackedUid(uid);
    setProfile(null);
    setError(null);
    setLoading(!!uid);
  }

  // Cuando cambia el uid recargamos. Tanto users reales como invitados
  // tienen doc — los invitados se siembran con `demoUser` desde Landing.
  const load = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    setLoading(true);

    // Lee el doc (sembrándolo si es invitado nuevo). Con timeout para que
    // un getDoc colgado no deje "cargando…" eterno.
    const fetchDoc = async (): Promise<UserDocument | null> => {
      let d = await withTimeout(getUserDocument(uid), 8000);
      // Edge case: invitado que vuelve con sesión persistente (sin pasar
      // por Landing.handleGuest) → su doc no se sembró. Lo sembramos aquí.
      // Para users reales, doc=null significa "pre-onboarding" — NO
      // sembramos nada, dejamos que el user pase por el onboarding.
      if (!d && isAnonymous) {
        await withTimeout(seedGuestDocument(uid), 8000);
        d = await withTimeout(getUserDocument(uid), 8000);
      }
      return d;
    };

    try {
      // Reintentos con backoff: el primer acceso a Firestore justo tras
      // signInAnonymously puede fallar/colgarse mientras App Check
      // propaga el token (sobre todo WebView móvil). Antes esto dejaba
      // al invitado atascado en "cargando…" hasta refrescar a mano.
      let doc: UserDocument | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          doc = await fetchDoc();
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await delay(500 * (attempt + 1));
        }
      }
      if (lastErr) throw lastErr;
      // Migración automática: si el doc existe pero le faltan campos del
      // schema actual (cuentas creadas antes de Fase 2A), los añade. Si
      // ya está al día es no-op y no dispara escritura.
      if (doc) {
        doc = await ensureUserDocumentSchema(uid, doc);
      }
      // Auto-reset semanal/mensual de creatina · igual que v1. Si la
      // marca de inicio del ciclo cae en una semana/mes anterior al
      // actual, ponemos el contador a 0 y avanzamos la marca. Solo
      // disparamos escritura si hace falta cambiar algo.
      if (doc) {
        doc = await maybeResetSupCounters(uid, doc);
      }
      setProfile(doc);
      // touchLastActive DESPUÉS del read. Si lo hacemos antes, Firestore
      // SDK aplica la escritura como mutación local y getDoc devuelve esa
      // vista pendiente con solo {lastActive}, sin el resto del doc. Solo
      // escribimos si el user ya tiene perfil completo — pre-onboarding
      // no creamos doc parcial.
      if (doc?.profile?.completed) {
        touchLastActive(uid).catch((err) => {
          console.warn('[BTal] touchLastActive error:', err);
        });
      }
    } catch (err) {
      console.error('[BTal] getUserDocument error:', err);
      setError('No hemos podido cargar tu perfil.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [uid, isAnonymous]);

  useEffect(() => {
    // Esperamos a que auth termine de cargar antes de tocar Firestore.
    if (authLoading) return;
    // Sincronización con sistema externo (Firestore): el setState
    // ocurre tras un await (async), no síncrono en el body del effect,
    // así que cumple la regla y no necesitamos disable.
    load();
  }, [authLoading, load]);

  const saveOnboarding = useCallback(
    async (profileData: UserProfile) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      await saveOnboardingProfile(uid, profileData);
      // Recargamos para tener el doc completo con createdAt/lastActive.
      await load();
    },
    [uid, load],
  );

  const updateProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Optimistic update real: aplicamos al state INMEDIATAMENTE para
      // que la UI responda sin esperar a Firestore. Si la escritura
      // remota falla, revertimos el cambio local y propagamos el error
      // al caller para que pueda mostrar feedback (toast, error inline).
      let snapshot: UserDocument | null = null;
      setProfile((prev) => {
        snapshot = prev;
        return prev
          ? { ...prev, profile: { ...prev.profile, ...partial }, lastActive: Date.now() }
          : prev;
      });
      try {
        await updateUserProfileFields(uid, partial);
      } catch (err) {
        // Revert · restauramos el snapshot pre-cambio para no dejar la UI
        // mostrando datos que nunca llegaron al servidor.
        setProfile(snapshot);
        throw err;
      }
    },
    [uid],
  );

  const updateMeal = useCallback(
    async (day: DayKey, meal: MealKey, partial: Partial<Comida>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Optimistic update local · aplicamos al state INMEDIATAMENTE para
      // que la UI responda sin esperar a Firestore. La marca source='user'
      // automática (cuando el partial no la incluye) la replicamos también
      // en local para que el badge "Tuyo" aparezca al instante.
      // Snapshot solo de la comida modificada (no del doc entero) para
      // que un revert por error NO pise cambios concurrentes en otras
      // comidas/secciones. Si el user edita Lunes-Desayuno y mientras
      // Firestore tarda edita Martes-Comida, un fallo del primero solo
      // revierte Lunes-Desayuno · el segundo queda intacto.
      let mealSnapshot: Comida | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        mealSnapshot = prev.menu[day][meal];
        const nextMeal: Comida = {
          ...mealSnapshot,
          ...partial,
          source: partial.source ?? 'user',
        };
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: {
              ...prev.menu[day],
              [meal]: nextMeal,
            },
          },
          lastActive: Date.now(),
        };
      });
      try {
        await updateUserMeal(uid, day, meal, partial);
      } catch (err) {
        // Revert SOLO de la comida que falló · usamos el setter callback
        // para componer con el state ACTUAL (no con un snapshot stale)
        // y respetar otras escrituras concurrentes.
        setProfile((current) => {
          if (!current || mealSnapshot === null) return current;
          return {
            ...current,
            menu: {
              ...current.menu,
              [day]: {
                ...current.menu[day],
                [meal]: mealSnapshot,
              },
            },
          };
        });
        throw err;
      }
    },
    [uid],
  );

  const duplicateMeal = useCallback(
    async (srcDay: DayKey, meal: MealKey, destDays: DayKey[]) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Filtramos el origen y dedup · Set garantiza que cada destino se
      // procesa una vez aunque el caller pase un array con repetidos.
      const targets = Array.from(new Set(destDays.filter((d) => d !== srcDay)));
      if (targets.length === 0) return;

      // Snapshot por destino · solo de la comida que vamos a sobrescribir,
      // no del doc entero. Si el Firestore write falla, revertimos solo
      // esos slots y respetamos cualquier otra edición concurrente que
      // haya entrado en otros días/secciones mientras tanto.
      const snapshots = new Map<DayKey, Comida | null>();

      // Construimos la comida copiada UNA vez (es la misma para todos los
      // destinos). Marcamos source='user' siempre · duplicar es un acto
      // manual del user aunque la origen viniera de IA.
      let nextMeal: Comida | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const src = prev.menu[srcDay][meal];
        nextMeal = { ...src, source: 'user' };
        const nextMenu = { ...prev.menu };
        for (const day of targets) {
          snapshots.set(day, prev.menu[day][meal]);
          nextMenu[day] = {
            ...prev.menu[day],
            [meal]: nextMeal,
          };
        }
        return {
          ...prev,
          menu: nextMenu,
          lastActive: Date.now(),
        };
      });

      // Si setProfile no ejecutó el callback (prev=null) cortamos · no hay
      // nada que duplicar y la escritura remota fallaría igualmente.
      if (!nextMeal) return;

      try {
        // Una sola escritura batch · Firestore aplica todos los paths
        // atómicamente. Pasamos la comida origen tal cual; el helper de
        // db ya marca source='user' en los destinos.
        const comidaSrc: Comida = nextMeal;
        await duplicateUserMeal(uid, srcDay, meal, comidaSrc, targets);
      } catch (err) {
        // Revert por destino · setter callback respeta otras escrituras
        // concurrentes que hayan entrado mientras esperábamos a Firestore.
        setProfile((current) => {
          if (!current) return current;
          const nextMenu = { ...current.menu };
          for (const day of targets) {
            const snap = snapshots.get(day);
            if (snap === undefined) continue;
            nextMenu[day] = {
              ...current.menu[day],
              [meal]: snap as Comida,
            };
          }
          return { ...current, menu: nextMenu };
        });
        throw err;
      }
    },
    [uid],
  );

  // ── Suplementación · batido + creatina ─────────────────────────────────
  // Setean la receta global. Optimistic local + revert si la escritura
  // remota falla. Snapshot de la config previa para restaurar exactamente
  // lo que había. No tocamos `daysWithBatido/Creatina` ni los contadores.
  const setBatidoConfig = useCallback(
    async (config: BatidoConfig) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: BatidoConfig | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos.batidoConfig;
        return {
          ...prev,
          suplementos: { ...prev.suplementos, batidoConfig: config },
          lastActive: Date.now(),
        };
      });
      try {
        await setBatidoConfigDb(uid, config);
      } catch (err) {
        if (snapshot !== null) {
          const prevConfig: BatidoConfig = snapshot;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              suplementos: { ...current.suplementos, batidoConfig: prevConfig },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  const setCreatinaConfig = useCallback(
    async (config: CreatinaConfig) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: CreatinaConfig | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos.creatinaConfig;
        return {
          ...prev,
          suplementos: { ...prev.suplementos, creatinaConfig: config },
          lastActive: Date.now(),
        };
      });
      try {
        await setCreatinaConfigDb(uid, config);
      } catch (err) {
        if (snapshot !== null) {
          const prevConfig: CreatinaConfig = snapshot;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              suplementos: { ...current.suplementos, creatinaConfig: prevConfig },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Toggle de "este día tiene batido/creatina añadido". Optimistic update
  // sobre el array correspondiente · si el día ya estaba (cuando on=true)
  // o si no estaba (cuando on=false), no es no-op porque Firestore es
  // arrayUnion/arrayRemove · idempotente. Revert solo si la escritura falla.
  const toggleSupInDay = useCallback(
    async (kind: 'batido' | 'creatina', day: DayKey, on: boolean) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      const field = kind === 'batido' ? 'daysWithBatido' : 'daysWithCreatina';
      let snapshot: DayKey[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos[field];
        const set = new Set(snapshot);
        if (on) set.add(day);
        else set.delete(day);
        return {
          ...prev,
          suplementos: { ...prev.suplementos, [field]: Array.from(set) },
          lastActive: Date.now(),
        };
      });
      try {
        await toggleSupInDayDb(uid, kind, day, on);
      } catch (err) {
        if (snapshot !== null) {
          const prevList: DayKey[] = snapshot;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              suplementos: { ...current.suplementos, [field]: prevList },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Vacía una comida (alimentos + macros) y devuelve el snapshot pre-borrado
  // para que el caller pueda implementar Deshacer. Optimistic update +
  // revert si la escritura remota falla. La hora se restaura al default.
  const clearMeal = useCallback(
    async (day: DayKey, meal: MealKey): Promise<Comida | null> => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: Comida | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.menu[day][meal];
        const cleared: Comida = {
          alimentos: [],
          hora: HORA_DEFECTO[meal],
          kcal: 0,
          prot: 0,
          carb: 0,
          fat: 0,
          source: 'default',
        };
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], [meal]: cleared },
          },
          lastActive: Date.now(),
        };
      });
      try {
        await clearUserMeal(uid, day, meal);
        return snapshot;
      } catch (err) {
        // Revert solo de la comida que falló · usamos setter callback para
        // respetar concurrencia con otras edits.
        if (snapshot !== null) {
          const prevSnap: Comida = snapshot;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], [meal]: prevSnap },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Restaura una comida desde un snapshot · usado por el undo del toast
  // post-borrado. Implementación: optimistic update local + escritura
  // remota con todos los campos del snapshot.
  const restoreMeal = useCallback(
    async (day: DayKey, meal: MealKey, snapshot: Comida) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Snapshot del estado ACTUAL (post-borrado) por si el restore falla
      // y tenemos que revertir al estado vacío.
      let preRestore: Comida | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        preRestore = prev.menu[day][meal];
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], [meal]: snapshot },
          },
          lastActive: Date.now(),
        };
      });
      try {
        // updateUserMeal con todos los campos del snapshot · marcamos source
        // explícito para que NO se sobrescriba a 'user' automáticamente.
        await updateUserMeal(uid, day, meal, {
          alimentos: snapshot.alimentos,
          hora: snapshot.hora,
          kcal: snapshot.kcal,
          prot: snapshot.prot,
          carb: snapshot.carb,
          fat: snapshot.fat,
          source: snapshot.source,
        });
      } catch (err) {
        if (preRestore !== null) {
          const prevSnap: Comida = preRestore;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], [meal]: prevSnap },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  const setSupOverride = useCallback(
    async (
      kind: 'batido' | 'creatina',
      day: DayKey,
      override: SupDayOverride | null,
    ) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      const field =
        kind === 'batido' ? 'batidoOverrides' : 'creatinaOverrides';
      let snapshot: SupDayOverride | undefined;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos[field][day];
        const nextOverrides = { ...prev.suplementos[field] };
        if (override === null) {
          delete nextOverrides[day];
        } else {
          nextOverrides[day] = override;
        }
        return {
          ...prev,
          suplementos: { ...prev.suplementos, [field]: nextOverrides },
          lastActive: Date.now(),
        };
      });
      try {
        await setSupOverrideDb(uid, kind, day, override);
      } catch (err) {
        // Revert al estado pre-edit · si snapshot era undefined, eliminamos
        // la entrada (volvemos a "no override"); si tenía valor, lo restauramos.
        const prevSnap = snapshot;
        setProfile((current) => {
          if (!current) return current;
          const nextOverrides = { ...current.suplementos[field] };
          if (prevSnap === undefined) {
            delete nextOverrides[day];
          } else {
            nextOverrides[day] = prevSnap;
          }
          return {
            ...current,
            suplementos: { ...current.suplementos, [field]: nextOverrides },
          };
        });
        throw err;
      }
    },
    [uid],
  );

  // ── Suplementación · contadores + stock · Sub-fase 2B.5.b ──────────────
  // Patrón común: optimistic update local + escritura remota; revert si
  // falla. Para contadores derivados (total++, restantes--) computamos el
  // patch entero antes de aplicarlo y lo enviamos como un solo updateDoc
  // por atomicidad (Firestore actualiza varios campos en una transacción
  // implícita).
  const setSupStockGramos = useCallback(
    async (kind: 'batido' | 'creatina', gramos: number | null) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      const field =
        kind === 'batido' ? 'batido_stock_gramos' : 'creatina_stock_gramos';
      let snapshot: number | null = null;
      let captured = false;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos[field];
        captured = true;
        return {
          ...prev,
          suplementos: { ...prev.suplementos, [field]: gramos },
          lastActive: Date.now(),
        };
      });
      try {
        await setSupStockGramosDb(uid, kind, gramos);
      } catch (err) {
        if (captured) {
          const prevN = snapshot;
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              suplementos: { ...current.suplementos, [field]: prevN },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Helper interno · aplica un patch de suplementos con optimistic update
  // y revert. Recibe el patch ya construido (con la lógica de incrementos
  // / decrementos / resets) y se encarga del transporte.
  //
  // ⚠ Anti-race: si el caller dispara dos clicks muy rápidos (típico en
  // pantallas táctiles · double-tap accidental) ambas invocaciones
  // pueden leer el state local ANTES del optimistic update del primer
  // tap. `supBusyRef` actúa como mutex: si una operación de suplementos
  // ya está en vuelo, el segundo tap se descarta. Es un ref (no state)
  // para no provocar re-render del Provider y mantener estables las
  // referencias de los handlers en el contexto.
  //
  // Bloquea a TODOS los handlers de suplementos (marcar/cancelar/inc/dec)
  // porque cualquier patch concurrente sobre `suplementos.*` puede
  // basarse en state stale. La operación dura ~50-200 ms (1 round trip
  // a Firestore) · imperceptible para el user.
  const supBusyRef = useRef(false);

  const applySupPatch = useCallback(
    async (patch: Partial<UserDocument['suplementos']>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: UserDocument['suplementos'] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.suplementos;
        return {
          ...prev,
          suplementos: { ...prev.suplementos, ...patch },
          lastActive: Date.now(),
        };
      });
      try {
        await patchSuplementos(uid, patch as Record<string, unknown>);
      } catch (err) {
        const prev = snapshot;
        if (prev !== null) {
          setProfile((current) => {
            if (!current) return current;
            return { ...current, suplementos: prev };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Marcar el batido como TOMADO HOY · igual que v1: 1 vez/día. Si ya
  // estaba marcado para hoy, no hace nada (idempotente).
  //
  // NOTA IMPORTANTE (v1 fidelity): NO descontamos gramos del stock al
  // marcar. El `stock_gramos` representa "lo comprado total" y solo se
  // modifica desde el modal de stock manual (o desde la lista de la
  // compra cuando llegue Fase 2C). El cálculo de "Restantes" es
  // `posibles - tomados`, donde `posibles = floor(stock / dosis)`. Si
  // descontáramos gramos del stock al marcar tendríamos doble
  // descuento (el stock baja Y los tomados suben), produciendo errores
  // visibles tipo "57 → 55" cuando el stock no es múltiplo exacto.
  //
  // Además del total, mantenemos contadores semanal/mensual con
  // auto-reset al cambiar de ISO week / mes (`maybeResetSupCounters`).
  //
  // Cap al máximo posible · igual que v1 `changeBatidos(1)` con
  // `Math.min(maxBatidos, ...)`. Si el user ya consumió todo el stock,
  // no se incrementa (necesita comprar/declarar más bote primero).
  const marcarBatidoTomadoHoy = useCallback(async () => {
    if (supBusyRef.current) return; // anti-race · doble-tap protect
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_batido_date === today) return;
    const max = calcBatidoStats(sup).posibles ?? Infinity;
    if (sup.batidos_tomados_total >= max) return; // sin stock disponible
    const now = Date.now();
    // Histórico fechado (Sub-fase 2E.1) · +1 al entry de hoy.
    const nextHistory = applySupHistoryDelta(sup.batidoHistory, today, +1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        batidos_tomados_total: sup.batidos_tomados_total + 1,
        batidos_tomados_semana: sup.batidos_tomados_semana + 1,
        batidos_tomados_mes: sup.batidos_tomados_mes + 1,
        batidos_tomados_anio: sup.batidos_tomados_anio + 1,
        batido_semana_inicio: sup.batido_semana_inicio ?? now,
        batido_mes_inicio: sup.batido_mes_inicio ?? now,
        batido_anio_inicio: sup.batido_anio_inicio ?? now,
        last_batido_date: today,
        batidoHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  // Cancelar el batido marcado hoy · revierte los 4 contadores
  // (total/semana/mes/año). Idempotente.
  const cancelarBatidoTomadoHoy = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_batido_date !== today) return;
    // Histórico · -1 al entry de hoy (si llega a 0 se elimina la entry).
    const nextHistory = applySupHistoryDelta(sup.batidoHistory, today, -1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        batidos_tomados_total: Math.max(0, sup.batidos_tomados_total - 1),
        batidos_tomados_semana: Math.max(0, sup.batidos_tomados_semana - 1),
        batidos_tomados_mes: Math.max(0, sup.batidos_tomados_mes - 1),
        batidos_tomados_anio: Math.max(0, sup.batidos_tomados_anio - 1),
        last_batido_date: null,
        batidoHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  // Marcar creatina suelta como TOMADA HOY · 1 vez/día. Actualiza
  // contadores total/semanal/mensual. NO toca stock (mismo motivo que
  // batido · evita doble descuento).
  //
  // Cap al máximo · igual que v1 `changeCreatinas(1)`. El cap considera
  // que los batidos ya tomados reservan creatina del bote (si
  // includeCreatina) · `calcCreatinaStats.posibles` lo aplica.
  const marcarCreatinaTomadaHoy = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_creatina_date === today) return;
    const max = calcCreatinaStats(sup).posibles ?? Infinity;
    if (sup.creatinas_tomadas_total >= max) return;
    const now = Date.now();
    const nextHistory = applySupHistoryDelta(sup.creatinaHistory, today, +1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        creatinas_tomadas_total: sup.creatinas_tomadas_total + 1,
        creatinas_tomadas_semana: sup.creatinas_tomadas_semana + 1,
        creatinas_tomadas_mes: sup.creatinas_tomadas_mes + 1,
        creatinas_tomadas_anio: sup.creatinas_tomadas_anio + 1,
        creatina_semana_inicio: sup.creatina_semana_inicio ?? now,
        creatina_mes_inicio: sup.creatina_mes_inicio ?? now,
        creatina_anio_inicio: sup.creatina_anio_inicio ?? now,
        last_creatina_date: today,
        creatinaHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  // Cancelar creatina marcada hoy · revierte total/semanal/mensual/anual.
  const cancelarCreatinaTomadaHoy = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_creatina_date !== today) return;
    const nextHistory = applySupHistoryDelta(sup.creatinaHistory, today, -1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        creatinas_tomadas_total: Math.max(0, sup.creatinas_tomadas_total - 1),
        creatinas_tomadas_semana: Math.max(0, sup.creatinas_tomadas_semana - 1),
        creatinas_tomadas_mes: Math.max(0, sup.creatinas_tomadas_mes - 1),
        creatinas_tomadas_anio: Math.max(0, sup.creatinas_tomadas_anio - 1),
        last_creatina_date: null,
        creatinaHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  const resetCreatinaSemanal = useCallback(async () => {
    await applySupPatch({
      creatinas_tomadas_semana: 0,
      creatina_semana_inicio: Date.now(),
    });
  }, [applySupPatch]);

  const resetCreatinaMensual = useCallback(async () => {
    await applySupPatch({
      creatinas_tomadas_mes: 0,
      creatina_mes_inicio: Date.now(),
    });
  }, [applySupPatch]);

  const resetCreatinaAnual = useCallback(async () => {
    await applySupPatch({
      creatinas_tomadas_anio: 0,
      creatina_anio_inicio: Date.now(),
    });
  }, [applySupPatch]);

  // Reset TOTAL · resetea los 4 contadores (total + semana + mes + año)
  // y actualiza las marcas de inicio. Mismo patrón que resetBatidoTotal.
  const resetCreatinaTotal = useCallback(async () => {
    const now = Date.now();
    await applySupPatch({
      creatinas_tomadas_total: 0,
      creatinas_tomadas_semana: 0,
      creatinas_tomadas_mes: 0,
      creatinas_tomadas_anio: 0,
      creatina_semana_inicio: now,
      creatina_mes_inicio: now,
      creatina_anio_inicio: now,
    });
  }, [applySupPatch]);

  // Restaura un patch directo a `suplementos` · usado por el flujo
  // "Deshacer" del toast tras un reset semanal/mensual/anual. El
  // componente captura el snapshot antes del reset y aquí lo restaura.
  const restoreSupValues = useCallback(
    async (patch: Partial<UserDocument['suplementos']>) => {
      await applySupPatch(patch);
    },
    [applySupPatch],
  );

  // Counter manual ±1 · modifica total/semana/mes/año sin tocar `last_*_date`.
  // El `last_*_date` lo gestiona solo `marcar/cancelar tomado hoy`. Esto
  // permite al user ajustar el histórico sin afectar el badge "tomado hoy".
  //
  // Cap al máximo · igual que v1 `changeBatidos(1)` con `Math.min(maxBatidos, ...)`.
  const incrementarBatidoTomado = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup) return;
    const max = calcBatidoStats(sup).posibles ?? Infinity;
    if (sup.batidos_tomados_total >= max) return; // sin stock disponible
    const now = Date.now();
    const today = todayDateStr();
    const nextHistory = applySupHistoryDelta(sup.batidoHistory, today, +1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        batidos_tomados_total: sup.batidos_tomados_total + 1,
        batidos_tomados_semana: sup.batidos_tomados_semana + 1,
        batidos_tomados_mes: sup.batidos_tomados_mes + 1,
        batidos_tomados_anio: sup.batidos_tomados_anio + 1,
        batido_semana_inicio: sup.batido_semana_inicio ?? now,
        batido_mes_inicio: sup.batido_mes_inicio ?? now,
        batido_anio_inicio: sup.batido_anio_inicio ?? now,
        batidoHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  const decrementarBatidoTomado = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup || sup.batidos_tomados_total === 0) return;
    // History · -1 al entry de hoy. Si no hay entry de hoy
    // (decremento manual sin haber tomado nada hoy) · `applySupHistoryDelta`
    // hace no-op · el counter total baja pero history no se desincroniza
    // hacia atrás (limitación documentada en utils/supHistory.ts).
    const today = todayDateStr();
    const nextHistory = applySupHistoryDelta(sup.batidoHistory, today, -1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        batidos_tomados_total: Math.max(0, sup.batidos_tomados_total - 1),
        batidos_tomados_semana: Math.max(0, sup.batidos_tomados_semana - 1),
        batidos_tomados_mes: Math.max(0, sup.batidos_tomados_mes - 1),
        batidos_tomados_anio: Math.max(0, sup.batidos_tomados_anio - 1),
        batidoHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  // Cap considera lo ya consumido por batidos (si includeCreatina) ·
  // calcCreatinaStats.posibles ya lo descuenta.
  const incrementarCreatinaTomada = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup) return;
    const max = calcCreatinaStats(sup).posibles ?? Infinity;
    if (sup.creatinas_tomadas_total >= max) return;
    const now = Date.now();
    const today = todayDateStr();
    const nextHistory = applySupHistoryDelta(sup.creatinaHistory, today, +1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        creatinas_tomadas_total: sup.creatinas_tomadas_total + 1,
        creatinas_tomadas_semana: sup.creatinas_tomadas_semana + 1,
        creatinas_tomadas_mes: sup.creatinas_tomadas_mes + 1,
        creatinas_tomadas_anio: sup.creatinas_tomadas_anio + 1,
        creatina_semana_inicio: sup.creatina_semana_inicio ?? now,
        creatina_mes_inicio: sup.creatina_mes_inicio ?? now,
        creatina_anio_inicio: sup.creatina_anio_inicio ?? now,
        creatinaHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  const decrementarCreatinaTomada = useCallback(async () => {
    if (supBusyRef.current) return;
    const sup = profile?.suplementos;
    if (!sup || sup.creatinas_tomadas_total === 0) return;
    const today = todayDateStr();
    const nextHistory = applySupHistoryDelta(sup.creatinaHistory, today, -1);
    supBusyRef.current = true;
    try {
      await applySupPatch({
        creatinas_tomadas_total: Math.max(0, sup.creatinas_tomadas_total - 1),
        creatinas_tomadas_semana: Math.max(0, sup.creatinas_tomadas_semana - 1),
        creatinas_tomadas_mes: Math.max(0, sup.creatinas_tomadas_mes - 1),
        creatinas_tomadas_anio: Math.max(0, sup.creatinas_tomadas_anio - 1),
        creatinaHistory: nextHistory,
      });
    } finally {
      supBusyRef.current = false;
    }
  }, [profile, applySupPatch]);

  const resetBatidoSemanal = useCallback(async () => {
    await applySupPatch({
      batidos_tomados_semana: 0,
      batido_semana_inicio: Date.now(),
    });
  }, [applySupPatch]);

  const resetBatidoMensual = useCallback(async () => {
    await applySupPatch({
      batidos_tomados_mes: 0,
      batido_mes_inicio: Date.now(),
    });
  }, [applySupPatch]);

  // Reset anual · resetea solo el contador del año natural.
  const resetBatidoAnual = useCallback(async () => {
    await applySupPatch({
      batidos_tomados_anio: 0,
      batido_anio_inicio: Date.now(),
    });
  }, [applySupPatch]);

  // Reset TOTAL · resetea los 4 contadores (total + semana + mes + año)
  // y actualiza las marcas de inicio de ciclo a "ahora". Es la opción
  // más lógica desde la perspectiva del user: "reiniciar todos los
  // contadores" = empezar de cero todo. Los resets parciales siguen
  // tocando solo el suyo.
  const resetBatidoTotal = useCallback(async () => {
    const now = Date.now();
    await applySupPatch({
      batidos_tomados_total: 0,
      batidos_tomados_semana: 0,
      batidos_tomados_mes: 0,
      batidos_tomados_anio: 0,
      batido_semana_inicio: now,
      batido_mes_inicio: now,
      batido_anio_inicio: now,
    });
  }, [applySupPatch]);

  // ── Comidas extras · Sub-fase 2B.5.b ───────────────────────────────────
  // Patrón común: leer array actual, modificar local, escribir array entero.
  // updateDoc con un array reemplaza el campo · Firestore no merge arrays.
  // Optimistic update + revert si la escritura falla.
  const addMealExtra = useCallback(
    async (day: DayKey, extra: ComidaExtra) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ComidaExtra[] | null = null;
      let nextExtras: ComidaExtra[] | null = null;
      let aborted = false;
      setProfile((prev) => {
        if (!prev) return prev;
        const current = prev.menu[day].extras;
        if (current.length >= MAX_EXTRAS_POR_DIA) {
          // Marcamos para abortar fuera del setter · NO lanzamos aquí
          // porque setState callbacks deben ser puros.
          aborted = true;
          return prev;
        }
        snapshot = current;
        nextExtras = [...current, extra];
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], extras: nextExtras },
          },
          lastActive: Date.now(),
        };
      });
      if (aborted) {
        throw new Error(
          `Máximo ${MAX_EXTRAS_POR_DIA} comidas extras por día.`,
        );
      }
      if (!nextExtras) return;
      try {
        await setUserMealExtras(uid, day, nextExtras);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], extras: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  const updateMealExtra = useCallback(
    async (day: DayKey, id: string, partial: Partial<ComidaExtra>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ComidaExtra[] | null = null;
      let nextExtras: ComidaExtra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const current = prev.menu[day].extras;
        snapshot = current;
        // Solo sobrescribimos `source` cuando el caller lo pasa
        // explícitamente · llamadas que solo tocan otros campos (p.ej.
        // toggle `deshabilitada` desde MenuPage) no deben alterar la
        // procedencia (IA vs user) del extra. Antes el `?? 'user'`
        // forzaba siempre a 'user' aunque el partial no incluyera
        // `source`, marcando como del usuario un extra que la IA
        // todavía debería poder regenerar.
        nextExtras = current.map((e) =>
          e.id === id ? { ...e, ...partial } : e,
        );
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], extras: nextExtras },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextExtras) return;
      try {
        await setUserMealExtras(uid, day, nextExtras);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], extras: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Duplica una `ComidaExtra` a uno o varios días destino. La copia
  // se crea con un id nuevo en cada destino (para que delete/edit
  // funcionen independientes). Devuelve `{added, skipped}` para que
  // la UI pueda mostrar feedback (días que estaban al límite de
  // MAX_EXTRAS_POR_DIA quedan en `skipped`). Optimistic local +
  // revert si falla la escritura remota.
  const duplicateMealExtra = useCallback(
    async (
      srcDay: DayKey,
      srcExtraId: string,
      destDays: DayKey[],
    ): Promise<{ added: DayKey[]; skipped: DayKey[] }> => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      const targets = Array.from(
        new Set(destDays.filter((d) => d !== srcDay)),
      );
      if (targets.length === 0) return { added: [], skipped: [] };

      // Snapshot por día de los arrays de extras a tocar · permite
      // revertir si el write a Firestore falla.
      const snapshots = new Map<DayKey, ComidaExtra[]>();
      const writes: Partial<Record<DayKey, ComidaExtra[]>> = {};
      const added: DayKey[] = [];
      const skipped: DayKey[] = [];

      setProfile((prev) => {
        if (!prev) return prev;
        const src = prev.menu[srcDay].extras.find(
          (e) => e.id === srcExtraId,
        );
        if (!src) return prev;
        const nextMenu = { ...prev.menu };
        for (const day of targets) {
          const currentList = prev.menu[day].extras;
          if (currentList.length >= MAX_EXTRAS_POR_DIA) {
            skipped.push(day);
            continue;
          }
          // Copia con nuevo id · resto de campos clonados. source='user'
          // siempre, igual que en duplicateMeal (duplicar es un acto
          // manual aunque la origen venga de IA).
          const copy: ComidaExtra = {
            ...src,
            id: newExtraId(),
            source: 'user',
          };
          snapshots.set(day, currentList);
          const nextList = [...currentList, copy];
          writes[day] = nextList;
          added.push(day);
          nextMenu[day] = { ...prev.menu[day], extras: nextList };
        }
        if (added.length === 0) return prev;
        return { ...prev, menu: nextMenu, lastActive: Date.now() };
      });

      if (added.length === 0) return { added, skipped };

      try {
        await duplicateUserMealExtras(uid, writes);
      } catch (err) {
        // Revert por día · respeta otras escrituras concurrentes.
        setProfile((current) => {
          if (!current) return current;
          const nextMenu = { ...current.menu };
          for (const day of added) {
            const snap = snapshots.get(day);
            if (!snap) continue;
            nextMenu[day] = { ...current.menu[day], extras: snap };
          }
          return { ...current, menu: nextMenu };
        });
        throw err;
      }

      return { added, skipped };
    },
    [uid],
  );

  const removeMealExtra = useCallback(
    async (day: DayKey, id: string): Promise<ComidaExtra | null> => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ComidaExtra[] | null = null;
      let removed: ComidaExtra | null = null;
      let nextExtras: ComidaExtra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const current = prev.menu[day].extras;
        snapshot = current;
        removed = current.find((e) => e.id === id) ?? null;
        nextExtras = current.filter((e) => e.id !== id);
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], extras: nextExtras },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextExtras) return null;
      try {
        await setUserMealExtras(uid, day, nextExtras);
        return removed;
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], extras: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Restaura un extra previamente eliminado (undo del toast post-borrado).
  // Se inserta al final del array · respeta el orden por hora cuando
  // MenuPage construye el listado para render.
  const restoreMealExtra = useCallback(
    async (day: DayKey, extra: ComidaExtra) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ComidaExtra[] | null = null;
      let nextExtras: ComidaExtra[] | null = null;
      let aborted = false;
      setProfile((prev) => {
        if (!prev) return prev;
        const current = prev.menu[day].extras;
        // Si el extra ya existe (caso raro · doble undo o sync race), no
        // duplicamos · sustituimos para que la UI quede consistente.
        snapshot = current;
        const filtered = current.filter((e) => e.id !== extra.id);
        // Defensa por límite MAX_EXTRAS_POR_DIA · si entre el borrado
        // y el undo el user (o un sync remoto) añadió suficientes
        // extras para llenar el día, el restore crearía una lista de
        // 9+ items y rompería la invariante. Abortamos y dejamos el
        // estado tal cual.
        if (filtered.length >= MAX_EXTRAS_POR_DIA) {
          aborted = true;
          return prev;
        }
        nextExtras = [...filtered, extra];
        return {
          ...prev,
          menu: {
            ...prev.menu,
            [day]: { ...prev.menu[day], extras: nextExtras },
          },
          lastActive: Date.now(),
        };
      });
      if (aborted) {
        throw new Error(
          `Máximo ${MAX_EXTRAS_POR_DIA} comidas extras por día.`,
        );
      }
      if (!nextExtras) return;
      try {
        await setUserMealExtras(uid, day, nextExtras);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: {
                ...current.menu,
                [day]: { ...current.menu[day], extras: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // ── Flags por día del menú · Sub-fase 2B.6 ────────────────────────
  // Excluir/Incluir un día de la media semanal · toggle dual.
  // Optimistic update + revert · réplica del v1 toggleExcludeDay.
  const toggleDayExcludedFromAvg = useCallback(
    async (day: DayKey) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: DayKey[] | null = null;
      let nextList: DayKey[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const flags = prev.menuFlags ?? defaultMenuFlags();
        snapshot = flags.excludedFromAvg;
        const isExcluded = flags.excludedFromAvg.includes(day);
        nextList = isExcluded
          ? flags.excludedFromAvg.filter((d) => d !== day)
          : [...flags.excludedFromAvg, day];
        return {
          ...prev,
          menuFlags: { ...flags, excludedFromAvg: nextList },
          lastActive: Date.now(),
        };
      });
      if (!nextList) return;
      try {
        await setUserMenuFlags(uid, { excludedFromAvg: nextList });
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const flags = current.menuFlags ?? defaultMenuFlags();
            return {
              ...current,
              menuFlags: { ...flags, excludedFromAvg: prevList },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Ocultar/Mostrar un día · toggle dual. Réplica del v1 toggleHideDay.
  const toggleDayHidden = useCallback(
    async (day: DayKey) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: DayKey[] | null = null;
      let nextList: DayKey[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const flags = prev.menuFlags ?? defaultMenuFlags();
        snapshot = flags.hidden;
        const isHidden = flags.hidden.includes(day);
        nextList = isHidden
          ? flags.hidden.filter((d) => d !== day)
          : [...flags.hidden, day];
        return {
          ...prev,
          menuFlags: { ...flags, hidden: nextList },
          lastActive: Date.now(),
        };
      });
      if (!nextList) return;
      try {
        await setUserMenuFlags(uid, { hidden: nextList });
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const flags = current.menuFlags ?? defaultMenuFlags();
            return {
              ...current,
              menuFlags: { ...flags, hidden: prevList },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // Resetea las 4 comidas + extras de un día concreto al estado por
  // defecto. Para invitados (`isDemo`) usa el menú demo del día; para
  // cuentas reales usa `defaultMenu()[day]` (4 comidas vacías).
  // Réplica del v1 resetDay (que recargaba la página para releer la
  // nube · aquí escribimos el default en Firestore directamente).
  // Devuelve el snapshot previo de las comidas (por si se quiere
  // implementar undo más adelante).
  const resetDayMenu = useCallback(
    async (day: DayKey): Promise<ComidasDelDia | null> => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ComidasDelDia | null = null;
      let nextComidas: ComidasDelDia | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.menu[day];
        // Origen del default: invitado → demo del día, real → defaultMenu()[day].
        nextComidas = prev.isDemo
          ? defaultDemoMenuForDay(day)
          : defaultMenu()[day];
        return {
          ...prev,
          menu: { ...prev.menu, [day]: nextComidas },
          lastActive: Date.now(),
        };
      });
      if (!nextComidas) return null;
      try {
        await setUserDayComidas(uid, day, nextComidas);
        return snapshot;
      } catch (err) {
        const prevComidas = snapshot;
        if (prevComidas !== null) {
          setProfile((current) => {
            if (!current) return current;
            return {
              ...current,
              menu: { ...current.menu, [day]: prevComidas },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // ── Lista de la compra · Sub-fase 2C ──────────────────────────────
  // Helper que lee la compra actual aplicando defaults si falta · útil
  // para todas las mutaciones que necesitan hacer copy-on-write.
  const readCompra = useCallback((doc: UserDocument | null): Compra => {
    if (!doc?.compra) return defaultCompra();
    return doc.compra;
  }, []);

  const addCompraItem = useCallback(
    async (catId: string, item: ItemCompra) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ItemCompra[] | null = null;
      let nextItems: ItemCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const current = compra.items[catId] ?? [];
        snapshot = current;
        nextItems = [...current, item];
        return {
          ...prev,
          compra: {
            ...compra,
            items: { ...compra.items, [catId]: nextItems },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextItems) return;
      try {
        await setUserCompraItemsOfCategoria(uid, catId, nextItems);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: {
                ...compra,
                items: { ...compra.items, [catId]: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const updateCompraItem = useCallback(
    async (catId: string, itemId: string, partial: Partial<ItemCompra>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ItemCompra[] | null = null;
      let nextItems: ItemCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const current = compra.items[catId] ?? [];
        snapshot = current;
        nextItems = current.map((it) =>
          it.id === itemId ? { ...it, ...partial, id: it.id } : it,
        );
        return {
          ...prev,
          compra: {
            ...compra,
            items: { ...compra.items, [catId]: nextItems },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextItems) return;
      try {
        await setUserCompraItemsOfCategoria(uid, catId, nextItems);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: {
                ...compra,
                items: { ...compra.items, [catId]: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const toggleCompraItemComprado = useCallback(
    async (catId: string, itemId: string) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Optimistic update síncrono · el toggle es instantáneo en la UI.
      let snapshot: ItemCompra[] | null = null;
      let nextItems: ItemCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const current = compra.items[catId] ?? [];
        snapshot = current;
        nextItems = current.map((it) =>
          it.id === itemId ? { ...it, comprado: !it.comprado } : it,
        );
        return {
          ...prev,
          compra: {
            ...compra,
            items: { ...compra.items, [catId]: nextItems },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextItems) return;
      try {
        await setUserCompraItemsOfCategoria(uid, catId, nextItems);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: {
                ...compra,
                items: { ...compra.items, [catId]: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const removeCompraItem = useCallback(
    async (catId: string, itemId: string) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ItemCompra[] | null = null;
      let removed: { item: ItemCompra; index: number } | null = null;
      let nextItems: ItemCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const current = compra.items[catId] ?? [];
        const index = current.findIndex((it) => it.id === itemId);
        if (index === -1) return prev;
        snapshot = current;
        removed = { item: current[index], index };
        nextItems = current.filter((it) => it.id !== itemId);
        return {
          ...prev,
          compra: {
            ...compra,
            items: { ...compra.items, [catId]: nextItems },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextItems) return null;
      try {
        await setUserCompraItemsOfCategoria(uid, catId, nextItems);
        return removed;
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: {
                ...compra,
                items: { ...compra.items, [catId]: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const restoreCompraItem = useCallback(
    async (catId: string, item: ItemCompra, index: number) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: ItemCompra[] | null = null;
      let nextItems: ItemCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const current = compra.items[catId] ?? [];
        // Si por race el item ya existe, no lo duplicamos.
        if (current.some((it) => it.id === item.id)) return prev;
        snapshot = current;
        const arr = [...current];
        const safeIndex = Math.min(Math.max(0, index), arr.length);
        arr.splice(safeIndex, 0, item);
        nextItems = arr;
        return {
          ...prev,
          compra: {
            ...compra,
            items: { ...compra.items, [catId]: nextItems },
          },
          lastActive: Date.now(),
        };
      });
      if (!nextItems) return;
      try {
        await setUserCompraItemsOfCategoria(uid, catId, nextItems);
      } catch (err) {
        const prevList = snapshot;
        if (prevList !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: {
                ...compra,
                items: { ...compra.items, [catId]: prevList },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const resetCompraChecks = useCallback(async () => {
    if (!uid) throw new Error('No hay usuario autenticado.');
    let snapshot: Compra | null = null;
    let nextCompra: Compra | null = null;
    setProfile((prev) => {
      if (!prev) return prev;
      const compra = readCompra(prev);
      snapshot = compra;
      const itemsOut: Record<string, ItemCompra[]> = {};
      for (const [catId, items] of Object.entries(compra.items)) {
        itemsOut[catId] = items.map((it) =>
          it.comprado ? { ...it, comprado: false } : it,
        );
      }
      nextCompra = { ...compra, items: itemsOut };
      return { ...prev, compra: nextCompra, lastActive: Date.now() };
    });
    if (!nextCompra) return;
    try {
      await setUserCompra(uid, nextCompra);
    } catch (err) {
      const prevC = snapshot;
      if (prevC !== null) {
        setProfile((current) =>
          current ? { ...current, compra: prevC } : current,
        );
      }
      throw err;
    }
  }, [uid, readCompra]);

  // Categorías personalizables · add/update/remove/reorder.
  const addCompraCategoria = useCallback(
    async (cat: CategoriaCompra) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: Compra | null = null;
      let nextCompra: Compra | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        // Si ya existe una con ese id, no duplicar.
        if (compra.categorias.some((c) => c.id === cat.id)) return prev;
        snapshot = compra;
        nextCompra = {
          categorias: [...compra.categorias, cat],
          items: { ...compra.items, [cat.id]: [] },
        };
        return { ...prev, compra: nextCompra, lastActive: Date.now() };
      });
      if (!nextCompra) return;
      try {
        await setUserCompra(uid, nextCompra);
      } catch (err) {
        const prevC = snapshot;
        if (prevC !== null) {
          setProfile((current) =>
            current ? { ...current, compra: prevC } : current,
          );
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const updateCompraCategoria = useCallback(
    async (catId: string, partial: Partial<CategoriaCompra>) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: CategoriaCompra[] | null = null;
      let nextCats: CategoriaCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        snapshot = compra.categorias;
        nextCats = compra.categorias.map((c) =>
          c.id === catId ? { ...c, ...partial, id: c.id, builtIn: c.builtIn } : c,
        );
        return {
          ...prev,
          compra: { ...compra, categorias: nextCats },
          lastActive: Date.now(),
        };
      });
      if (!nextCats) return;
      try {
        await setUserCompraCategorias(uid, nextCats);
      } catch (err) {
        const prevCats = snapshot;
        if (prevCats !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: { ...compra, categorias: prevCats },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const removeCompraCategoria = useCallback(
    async (catId: string) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      // Solo categorías custom · builtIn no se pueden eliminar (estilo v1).
      let snapshot: Compra | null = null;
      let removed: { categoria: CategoriaCompra; items: ItemCompra[] } | null = null;
      let nextCompra: Compra | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        const cat = compra.categorias.find((c) => c.id === catId);
        if (!cat || cat.builtIn) return prev;
        snapshot = compra;
        removed = { categoria: cat, items: compra.items[catId] ?? [] };
        const { [catId]: _droppedItems, ...restItems } = compra.items;
        // Silencia warning de variable no usada · es destructuring para
        // omitir la key.
        void _droppedItems;
        nextCompra = {
          categorias: compra.categorias.filter((c) => c.id !== catId),
          items: restItems,
        };
        return { ...prev, compra: nextCompra, lastActive: Date.now() };
      });
      if (!nextCompra) return null;
      try {
        await setUserCompra(uid, nextCompra);
        return removed;
      } catch (err) {
        const prevC = snapshot;
        if (prevC !== null) {
          setProfile((current) =>
            current ? { ...current, compra: prevC } : current,
          );
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const restoreCompraCategoria = useCallback(
    async (categoria: CategoriaCompra, items: ItemCompra[]) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: Compra | null = null;
      let nextCompra: Compra | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        // Si ya existe (race), no duplicar.
        if (compra.categorias.some((c) => c.id === categoria.id)) return prev;
        snapshot = compra;
        nextCompra = {
          categorias: [...compra.categorias, categoria],
          items: { ...compra.items, [categoria.id]: items },
        };
        return { ...prev, compra: nextCompra, lastActive: Date.now() };
      });
      if (!nextCompra) return;
      try {
        await setUserCompra(uid, nextCompra);
      } catch (err) {
        const prevC = snapshot;
        if (prevC !== null) {
          setProfile((current) =>
            current ? { ...current, compra: prevC } : current,
          );
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  const reorderCompraCategorias = useCallback(
    async (orderedIds: string[]) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: CategoriaCompra[] | null = null;
      let nextCats: CategoriaCompra[] | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const compra = readCompra(prev);
        snapshot = compra.categorias;
        // Reordena según `orderedIds` y renumera el campo `order` de
        // 0 a N-1 para mantener consistencia. Categorías que falten
        // del array (caso edge: race) se añaden al final preservadas.
        const byId = new Map(compra.categorias.map((c) => [c.id, c]));
        const ordered: CategoriaCompra[] = [];
        orderedIds.forEach((id, idx) => {
          const c = byId.get(id);
          if (c) {
            ordered.push({ ...c, order: idx });
            byId.delete(id);
          }
        });
        // Añade las que no se pasaron en orderedIds (preserva su orden actual).
        for (const c of byId.values()) {
          ordered.push({ ...c, order: ordered.length });
        }
        nextCats = ordered;
        return {
          ...prev,
          compra: { ...compra, categorias: nextCats },
          lastActive: Date.now(),
        };
      });
      if (!nextCats) return;
      try {
        await setUserCompraCategorias(uid, nextCats);
      } catch (err) {
        const prevCats = snapshot;
        if (prevCats !== null) {
          setProfile((current) => {
            if (!current) return current;
            const compra = readCompra(current);
            return {
              ...current,
              compra: { ...compra, categorias: prevCats },
            };
          });
        }
        throw err;
      }
    },
    [uid, readCompra],
  );

  // (Recordatorio: COMPRA_BUILTIN_IDS se exporta desde defaultUser.ts
  // para que la UI pueda saber cuáles NO son borrables, sin necesidad
  // de iterar sobre `categorias.builtIn`.)
  void COMPRA_BUILTIN_IDS;

  // ──────────────────────────────────────────────────────────────────
  // Entrenos · Sub-fase 2D · CRUD planes y días.
  // Mismo patrón que compra: optimistic update + revert si Firestore
  // falla. Las acciones que requieren shape correcto leen `entrenos`
  // a través de un helper local para tipar bien.
  // ──────────────────────────────────────────────────────────────────

  const readEntrenos = useCallback((doc: UserDocument): Entrenos => {
    return doc.entrenos;
  }, []);

  const setActivePlan = useCallback(
    async (planId: string) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: string | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.entrenos.activePlan;
        return {
          ...prev,
          entrenos: { ...prev.entrenos, activePlan: planId },
          lastActive: Date.now(),
        };
      });
      try {
        await setUserActivePlan(uid, planId);
      } catch (err) {
        const prevId = snapshot;
        if (prevId !== null) {
          setProfile((cur) =>
            cur
              ? { ...cur, entrenos: { ...cur.entrenos, activePlan: prevId } }
              : cur,
          );
        }
        throw err;
      }
    },
    [uid],
  );

  const setPlanEntreno = useCallback(
    async (plan: PlanEntreno) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: PlanEntreno | undefined;
      setProfile((prev) => {
        if (!prev) return prev;
        snapshot = prev.entrenos.planes[plan.id];
        return {
          ...prev,
          entrenos: {
            ...prev.entrenos,
            planes: { ...prev.entrenos.planes, [plan.id]: plan },
          },
          lastActive: Date.now(),
        };
      });
      try {
        await setUserPlanEntreno(uid, plan);
      } catch (err) {
        const prevPlan = snapshot;
        setProfile((cur) => {
          if (!cur) return cur;
          const planes = { ...cur.entrenos.planes };
          if (prevPlan) {
            planes[plan.id] = prevPlan;
          } else {
            delete planes[plan.id];
          }
          return { ...cur, entrenos: { ...cur.entrenos, planes } };
        });
        throw err;
      }
    },
    [uid],
  );

  const removePlanEntreno = useCallback(
    async (planId: string): Promise<PlanEntreno | null> => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let removed: PlanEntreno | null = null;
      let prevActive: string | null = null;
      setProfile((prev) => {
        if (!prev) return prev;
        const target = prev.entrenos.planes[planId];
        if (!target) return prev;
        if (target.builtIn) {
          throw new Error(
            'No se puede eliminar un plan builtIn (1dias..7dias).',
          );
        }
        removed = target;
        prevActive = prev.entrenos.activePlan;
        const planes = { ...prev.entrenos.planes };
        delete planes[planId];
        // Si borramos el plan activo, fallback al 4dias (siempre existe).
        const nextActive =
          prev.entrenos.activePlan === planId
            ? '4dias'
            : prev.entrenos.activePlan;
        return {
          ...prev,
          entrenos: { ...prev.entrenos, planes, activePlan: nextActive },
          lastActive: Date.now(),
        };
      });
      if (!removed) return null;
      try {
        await deleteUserPlanEntreno(uid, planId);
        // Si reasignamos active a 4dias, persistirlo también.
        if (prevActive === planId) {
          await setUserActivePlan(uid, '4dias');
        }
        return removed;
      } catch (err) {
        // TS narrowing dentro del callback de setProfile · usamos cast
        // explícito para que el closure conserve el tipo PlanEntreno.
        const restore = removed as PlanEntreno;
        const wasActive = prevActive;
        setProfile((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            entrenos: {
              ...cur.entrenos,
              planes: { ...cur.entrenos.planes, [restore.id]: restore },
              activePlan: wasActive ?? cur.entrenos.activePlan,
            },
          };
        });
        throw err;
      }
    },
    [uid],
  );

  const restorePlanEntreno = useCallback(
    async (plan: PlanEntreno) => {
      // Misma operación que setPlanEntreno · semánticamente "restore"
      // se distingue del create solo en el caller.
      await setPlanEntreno(plan);
    },
    [setPlanEntreno],
  );

  const updateDiaEntreno = useCallback(
    async (planId: string, diaIdx: number, dia: DiaEntreno) => {
      if (!uid) throw new Error('No hay usuario autenticado.');
      let snapshot: DiaEntreno | undefined;
      let currentDias: DiaEntreno[] = [];
      setProfile((prev) => {
        if (!prev) return prev;
        const plan = prev.entrenos.planes[planId];
        if (!plan) return prev;
        // Capturamos los dias ACTUALES (antes del update) para que el
        // setUserDiaEntreno escriba el array completo a Firestore con
        // el día reemplazado · evita corromper el array en map de
        // índices que Firestore hace con dot-path numérico.
        currentDias = plan.dias;
        snapshot = plan.dias[diaIdx];
        const dias = [...plan.dias];
        dias[diaIdx] = dia;
        return {
          ...prev,
          entrenos: {
            ...prev.entrenos,
            planes: {
              ...prev.entrenos.planes,
              [planId]: { ...plan, dias },
            },
          },
          lastActive: Date.now(),
        };
      });
      try {
        await setUserDiaEntreno(uid, planId, diaIdx, dia, currentDias);
      } catch (err) {
        const prevDia = snapshot;
        if (prevDia) {
          setProfile((cur) => {
            if (!cur) return cur;
            const plan = cur.entrenos.planes[planId];
            if (!plan) return cur;
            const dias = [...plan.dias];
            dias[diaIdx] = prevDia;
            return {
              ...cur,
              entrenos: {
                ...cur.entrenos,
                planes: {
                  ...cur.entrenos.planes,
                  [planId]: { ...plan, dias },
                },
              },
            };
          });
        }
        throw err;
      }
    },
    [uid],
  );

  // readEntrenos export helper · evita el linter quejándose de unused
  // ahora que solo lo usamos en los callbacks como type guard implícito.
  void readEntrenos;

  // Memoizamos el value · todas las acciones son `useCallback` con
  // dependencias estables (uid), así que solo cambia el value cuando
  // cambian los datos reactivos (profile/loading/error). Sin esto el
  // objeto se recrea en cada render del Provider y arrastra a todo
  // el árbol consumidor (5 tabs + 30+ modales) a re-renderizar.
  const value = useMemo<ProfileState>(
    () => ({
      profile,
      loading,
      error,
      refresh: load,
      saveOnboarding,
      updateProfile,
      updateMeal,
      duplicateMeal,
      setBatidoConfig,
      setCreatinaConfig,
      toggleSupInDay,
      clearMeal,
      restoreMeal,
      setSupOverride,
      addMealExtra,
      updateMealExtra,
      removeMealExtra,
      restoreMealExtra,
      duplicateMealExtra,
      toggleDayExcludedFromAvg,
      toggleDayHidden,
      resetDayMenu,
      setSupStockGramos,
      marcarBatidoTomadoHoy,
      cancelarBatidoTomadoHoy,
      marcarCreatinaTomadaHoy,
      cancelarCreatinaTomadaHoy,
      incrementarBatidoTomado,
      decrementarBatidoTomado,
      incrementarCreatinaTomada,
      decrementarCreatinaTomada,
      resetBatidoSemanal,
      resetBatidoMensual,
      resetBatidoAnual,
      resetBatidoTotal,
      resetCreatinaSemanal,
      resetCreatinaMensual,
      resetCreatinaAnual,
      resetCreatinaTotal,
      restoreSupValues,
      addCompraItem,
      updateCompraItem,
      toggleCompraItemComprado,
      removeCompraItem,
      restoreCompraItem,
      resetCompraChecks,
      addCompraCategoria,
      updateCompraCategoria,
      removeCompraCategoria,
      restoreCompraCategoria,
      reorderCompraCategorias,
      setActivePlan,
      setPlanEntreno,
      removePlanEntreno,
      restorePlanEntreno,
      updateDiaEntreno,
    }),
    [
      profile,
      loading,
      error,
      load,
      saveOnboarding,
      updateProfile,
      updateMeal,
      duplicateMeal,
      setBatidoConfig,
      setCreatinaConfig,
      toggleSupInDay,
      clearMeal,
      restoreMeal,
      setSupOverride,
      addMealExtra,
      updateMealExtra,
      removeMealExtra,
      restoreMealExtra,
      duplicateMealExtra,
      toggleDayExcludedFromAvg,
      toggleDayHidden,
      resetDayMenu,
      setSupStockGramos,
      marcarBatidoTomadoHoy,
      cancelarBatidoTomadoHoy,
      marcarCreatinaTomadaHoy,
      cancelarCreatinaTomadaHoy,
      incrementarBatidoTomado,
      decrementarBatidoTomado,
      incrementarCreatinaTomada,
      decrementarCreatinaTomada,
      resetBatidoSemanal,
      resetBatidoMensual,
      resetBatidoAnual,
      resetBatidoTotal,
      resetCreatinaSemanal,
      resetCreatinaMensual,
      resetCreatinaAnual,
      resetCreatinaTotal,
      restoreSupValues,
      addCompraItem,
      updateCompraItem,
      toggleCompraItemComprado,
      removeCompraItem,
      restoreCompraItem,
      resetCompraChecks,
      addCompraCategoria,
      updateCompraCategoria,
      removeCompraCategoria,
      restoreCompraCategoria,
      reorderCompraCategorias,
      setActivePlan,
      setPlanEntreno,
      removePlanEntreno,
      restorePlanEntreno,
      updateDiaEntreno,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
