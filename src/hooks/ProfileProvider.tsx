import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  clearUserMeal,
  duplicateUserMeal,
  ensureUserDocumentSchema,
  getUserDocument,
  patchSuplementos,
  saveOnboardingProfile,
  seedGuestDocument,
  setBatidoConfig as setBatidoConfigDb,
  setCreatinaConfig as setCreatinaConfigDb,
  setSupOverride as setSupOverrideDb,
  setSupStockGramos as setSupStockGramosDb,
  setUserMealExtras,
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
  HORA_DEFECTO,
  MAX_EXTRAS_POR_DIA,
  calcBatidoStats,
  calcCreatinaStats,
  type BatidoConfig,
  type Comida,
  type ComidaExtra,
  type CreatinaConfig,
  type DayKey,
  type MealKey,
  type SupDayOverride,
  type UserDocument,
  type UserProfile,
} from '../templates/defaultUser';
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
    try {
      let doc = await getUserDocument(uid);
      // Edge case: invitado que vuelve con sesión persistente (sin pasar
      // por Landing.handleGuest) → su doc no se sembró. Lo sembramos aquí.
      // Para users reales, doc=null significa "pre-onboarding" — NO
      // sembramos nada, dejamos que el user pase por el onboarding.
      if (!doc && isAnonymous) {
        await seedGuestDocument(uid);
        doc = await getUserDocument(uid);
      }
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
    // Sincronización con sistema externo (Firestore): caso explícitamente
    // permitido por la doc de React. La regla de eslint no distingue cuándo
    // setState se llama por la respuesta de una API vs en el body del effect,
    // así que la silenciamos aquí.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_batido_date === today) return;
    const max = calcBatidoStats(sup).posibles ?? Infinity;
    if (sup.batidos_tomados_total >= max) return; // sin stock disponible
    const now = Date.now();
    await applySupPatch({
      batidos_tomados_total: sup.batidos_tomados_total + 1,
      batidos_tomados_semana: sup.batidos_tomados_semana + 1,
      batidos_tomados_mes: sup.batidos_tomados_mes + 1,
      batidos_tomados_anio: sup.batidos_tomados_anio + 1,
      batido_semana_inicio: sup.batido_semana_inicio ?? now,
      batido_mes_inicio: sup.batido_mes_inicio ?? now,
      batido_anio_inicio: sup.batido_anio_inicio ?? now,
      last_batido_date: today,
    });
  }, [profile, applySupPatch]);

  // Cancelar el batido marcado hoy · revierte los 4 contadores
  // (total/semana/mes/año). Idempotente.
  const cancelarBatidoTomadoHoy = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_batido_date !== today) return;
    await applySupPatch({
      batidos_tomados_total: Math.max(0, sup.batidos_tomados_total - 1),
      batidos_tomados_semana: Math.max(0, sup.batidos_tomados_semana - 1),
      batidos_tomados_mes: Math.max(0, sup.batidos_tomados_mes - 1),
      batidos_tomados_anio: Math.max(0, sup.batidos_tomados_anio - 1),
      last_batido_date: null,
    });
  }, [profile, applySupPatch]);

  // Marcar creatina suelta como TOMADA HOY · 1 vez/día. Actualiza
  // contadores total/semanal/mensual. NO toca stock (mismo motivo que
  // batido · evita doble descuento).
  //
  // Cap al máximo · igual que v1 `changeCreatinas(1)`. El cap considera
  // que los batidos ya tomados reservan creatina del bote (si
  // includeCreatina) · `calcCreatinaStats.posibles` lo aplica.
  const marcarCreatinaTomadaHoy = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_creatina_date === today) return;
    const max = calcCreatinaStats(sup).posibles ?? Infinity;
    if (sup.creatinas_tomadas_total >= max) return;
    const now = Date.now();
    await applySupPatch({
      creatinas_tomadas_total: sup.creatinas_tomadas_total + 1,
      creatinas_tomadas_semana: sup.creatinas_tomadas_semana + 1,
      creatinas_tomadas_mes: sup.creatinas_tomadas_mes + 1,
      creatinas_tomadas_anio: sup.creatinas_tomadas_anio + 1,
      creatina_semana_inicio: sup.creatina_semana_inicio ?? now,
      creatina_mes_inicio: sup.creatina_mes_inicio ?? now,
      creatina_anio_inicio: sup.creatina_anio_inicio ?? now,
      last_creatina_date: today,
    });
  }, [profile, applySupPatch]);

  // Cancelar creatina marcada hoy · revierte total/semanal/mensual/anual.
  const cancelarCreatinaTomadaHoy = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup) return;
    const today = todayDateStr();
    if (sup.last_creatina_date !== today) return;
    await applySupPatch({
      creatinas_tomadas_total: Math.max(0, sup.creatinas_tomadas_total - 1),
      creatinas_tomadas_semana: Math.max(0, sup.creatinas_tomadas_semana - 1),
      creatinas_tomadas_mes: Math.max(0, sup.creatinas_tomadas_mes - 1),
      creatinas_tomadas_anio: Math.max(0, sup.creatinas_tomadas_anio - 1),
      last_creatina_date: null,
    });
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
    const sup = profile?.suplementos;
    if (!sup) return;
    const max = calcBatidoStats(sup).posibles ?? Infinity;
    if (sup.batidos_tomados_total >= max) return; // sin stock disponible
    const now = Date.now();
    await applySupPatch({
      batidos_tomados_total: sup.batidos_tomados_total + 1,
      batidos_tomados_semana: sup.batidos_tomados_semana + 1,
      batidos_tomados_mes: sup.batidos_tomados_mes + 1,
      batidos_tomados_anio: sup.batidos_tomados_anio + 1,
      batido_semana_inicio: sup.batido_semana_inicio ?? now,
      batido_mes_inicio: sup.batido_mes_inicio ?? now,
      batido_anio_inicio: sup.batido_anio_inicio ?? now,
    });
  }, [profile, applySupPatch]);

  const decrementarBatidoTomado = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup || sup.batidos_tomados_total === 0) return;
    await applySupPatch({
      batidos_tomados_total: Math.max(0, sup.batidos_tomados_total - 1),
      batidos_tomados_semana: Math.max(0, sup.batidos_tomados_semana - 1),
      batidos_tomados_mes: Math.max(0, sup.batidos_tomados_mes - 1),
      batidos_tomados_anio: Math.max(0, sup.batidos_tomados_anio - 1),
    });
  }, [profile, applySupPatch]);

  // Cap considera lo ya consumido por batidos (si includeCreatina) ·
  // calcCreatinaStats.posibles ya lo descuenta.
  const incrementarCreatinaTomada = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup) return;
    const max = calcCreatinaStats(sup).posibles ?? Infinity;
    if (sup.creatinas_tomadas_total >= max) return;
    const now = Date.now();
    await applySupPatch({
      creatinas_tomadas_total: sup.creatinas_tomadas_total + 1,
      creatinas_tomadas_semana: sup.creatinas_tomadas_semana + 1,
      creatinas_tomadas_mes: sup.creatinas_tomadas_mes + 1,
      creatinas_tomadas_anio: sup.creatinas_tomadas_anio + 1,
      creatina_semana_inicio: sup.creatina_semana_inicio ?? now,
      creatina_mes_inicio: sup.creatina_mes_inicio ?? now,
      creatina_anio_inicio: sup.creatina_anio_inicio ?? now,
    });
  }, [profile, applySupPatch]);

  const decrementarCreatinaTomada = useCallback(async () => {
    const sup = profile?.suplementos;
    if (!sup || sup.creatinas_tomadas_total === 0) return;
    await applySupPatch({
      creatinas_tomadas_total: Math.max(0, sup.creatinas_tomadas_total - 1),
      creatinas_tomadas_semana: Math.max(0, sup.creatinas_tomadas_semana - 1),
      creatinas_tomadas_mes: Math.max(0, sup.creatinas_tomadas_mes - 1),
      creatinas_tomadas_anio: Math.max(0, sup.creatinas_tomadas_anio - 1),
    });
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
        nextExtras = current.map((e) =>
          e.id === id
            ? { ...e, ...partial, source: partial.source ?? 'user' }
            : e,
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
      setProfile((prev) => {
        if (!prev) return prev;
        const current = prev.menu[day].extras;
        // Si el extra ya existe (caso raro · doble undo o sync race), no
        // duplicamos · sustituimos para que la UI quede consistente.
        snapshot = current;
        const filtered = current.filter((e) => e.id !== extra.id);
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

  const value: ProfileState = {
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
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
