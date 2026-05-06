import { useContext } from 'react';
import { ProfileContext, type ProfileState } from './profile-context';

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within <ProfileProvider>');
  return ctx;
}

export type { ProfileState };
