import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  getUserDocument,
  saveOnboardingProfile,
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
    setLoading(true);
    setError(null);
    try {
      const doc = await getUserDocument(uid);
      setProfile(doc);
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
