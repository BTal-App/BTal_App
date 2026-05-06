import { createContext } from 'react';
import type { UserDocument, UserProfile } from '../templates/defaultUser';

export interface ProfileState {
  // null = aún no cargado · UserDocument | null = cargado (puede ser null si
  // el usuario no tiene documento todavía — caso onboarding pendiente).
  profile: UserDocument | null;
  loading: boolean;
  error: string | null;

  // Refresca el documento del usuario desde Firestore.
  refresh: () => Promise<void>;

  // Guarda el perfil de onboarding (crea o actualiza el doc completo).
  saveOnboarding: (profile: UserProfile) => Promise<void>;

  // Actualiza solo algunos campos del perfil ya existente (Settings →
  // "Editar datos del perfil"). No toca `completed` ni el resto del doc.
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
}

export const ProfileContext = createContext<ProfileState | null>(null);
