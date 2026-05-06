import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  ensureUserDocumentSchema,
  getUserDocument,
  saveOnboardingProfile,
  seedGuestDocument,
  touchLastActive,
  updateUserProfileFields,
} from '../services/db';
import type { UserDocument, UserProfile } from '../templates/defaultUser';
import { ProfileContext, type ProfileState } from './profile-context';

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

  const value: ProfileState = {
    profile,
    loading,
    error,
    refresh: load,
    saveOnboarding,
    updateProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
