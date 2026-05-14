import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { ProfileSheet } from './ProfileSheet';
import { initialsOf } from '../utils/userDisplay';
import { blurAndRun } from '../utils/focus';

// Botón circular con la foto/inicial del usuario que abre el ProfileSheet.
// Encapsula avatar + estado + sheet en un solo componente para que cada tab
// principal (Hoy, Menú, Compra, Entreno, Registro) lo monte con una sola
// línea. Evita duplicar la lógica de iniciales/foto/sheet por tab.
//
// El ProfileSheet se monta lazy: solo se renderiza tras la primera apertura
// para no cargarlo en el primer paint de cada tab.
export function AppAvatarButton() {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  // Track de si alguna vez se abrió · evita montar ProfileSheet en cada
  // tab nada más entrar (lazy mount, igual que en HoyPage v1).
  const [hasOpened, setHasOpened] = useState(false);

  if (!user) return null;

  // Iniciales · prioridad: profile.nombre (lo que el user escribió en el
  // onboarding · su forma preferida de llamarse) > user.displayName (viene
  // de Google/Apple sign-in · puede ser legalmente largo o no preferido) >
  // email (último fallback). Antes priorizábamos displayName primero, lo
  // que ignoraba el nombre que el user había escrito explícitamente.
  const profileName = userDoc?.profile?.nombre?.trim() || null;
  const initials = initialsOf(
    profileName ?? user.displayName,
    user.email,
  );

  const open = () => {
    setHasOpened(true);
    setProfileOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="app-avatar-btn"
        onClick={blurAndRun(open)}
        aria-label="Abrir perfil"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {hasOpened && (
        <ProfileSheet
          isOpen={profileOpen}
          user={user}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}
