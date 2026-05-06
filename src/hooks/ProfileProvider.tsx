import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  getUserDocument,
  saveOnboardingProfile,
  touchLastActive,
} from '../services/db';
import type { UserDocument, UserProfile } from '../templates/defaultUser';
import { ProfileContext, type ProfileState } from './profile-context';

// Carga el documento /users/{uid} cuando hay sesión y lo expone al árbol.
// Componentes consumidores: Dashboard (decide si redirige a /onboarding) y
// Onboarding (lee/escribe profile).
//
// El usuario invitado (anónimo) aún no escribe nada en Firestore — para
// invitados profile siempre es null y Dashboard NO debe llamar al onboarding.
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
  // Dashboard ve eso y redirige a /onboarding aunque el user sí tenga su
  // perfil completo en Firestore — solo que aún no lo hemos cargado.
  // Resetando durante render con state-from-prop garantizamos que el
  // primer render ya muestra loading=true y nadie redirige por error.
  const [trackedUid, setTrackedUid] = useState<string | null>(uid);
  if (trackedUid !== uid) {
    setTrackedUid(uid);
    setProfile(null);
    setError(null);
    // loading=true si vamos a cargar (real user con uid). false si no hay
    // nada que cargar (logout, o invitado).
    setLoading(!!uid && !isAnonymous);
  }

  // Cuando cambia el uid, recargamos. Para invitados no leemos Firestore
  // (las reglas lo permitirían, pero para qué llamar si no hay nada).
  const load = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (isAnonymous) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const doc = await getUserDocument(uid);
      setProfile(doc);
      // touchLastActive DESPUÉS del read. Si lo hacemos antes (como hacía
      // Dashboard antes), Firestore SDK aplica la escritura como mutación
      // local y getDoc devuelve esa vista pendiente con solo {lastActive},
      // sin el resto del doc. Solo escribimos si el user ya tiene perfil
      // completo — pre-onboarding no creamos doc parcial.
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

  const value: ProfileState = {
    profile,
    loading,
    error,
    refresh: load,
    saveOnboarding,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
