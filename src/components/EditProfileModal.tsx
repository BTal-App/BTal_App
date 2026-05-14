import { useRef, useState, type ChangeEvent } from 'react';
import { IonButton, IonModal, IonSpinner } from '@ionic/react';
import { MealIcon } from './MealIcon';
import type { User } from 'firebase/auth';
import { updateUserProfile } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { resizeImageToDataUrl } from '../utils/resizeImage';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { initialsOf, toTitleCase } from '../utils/userDisplay';
import './SettingsModal.css';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

const errorCode = (err: unknown): string =>
  (err as { code?: string })?.code ?? '';

function translateError(code: string): string {
  const map: Record<string, string> = {
    'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
    'auth/requires-recent-login': 'Tu sesión es vieja. Cierra sesión y vuelve a entrar.',
  };
  return map[code] ?? 'No hemos podido guardar el perfil. Inténtalo de nuevo.';
}

export function EditProfileModal({ isOpen, user, onClose }: Props) {
  const { refreshUser } = useAuth();
  const { profile: userDoc, updateProfile: updateProfileDoc } = useProfile();
  // Prioridad inicial: `profile.nombre` (lo que escribió en onboarding · su
  // forma preferida de llamarse) > Auth.displayName (de Google/Apple) > ''.
  // Antes solo leíamos Auth.displayName, lo que daba input vacío a users de
  // email/password aunque tuvieran nombre en perfil.
  const initialName =
    userDoc?.profile?.nombre?.trim() || user.displayName?.trim() || '';
  const [name, setName] = useState(initialName);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photoURL ?? null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: { name: string | null; photoUrl: string | null };
  } | null>(null);

  // Dos inputs distintos: galería y cámara. En móvil con `capture` el SO
  // abre la cámara directamente; sin `capture` deja elegir de galería.
  // En desktop ambos abren un selector de archivos.
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setName(
      userDoc?.profile?.nombre?.trim() || user.displayName?.trim() || '',
    );
    setPhotoUrl(user.photoURL ?? null);
    setBusy(false);
    setImgBusy(false);
    setError('');
    setConfirmChanges(null);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    setImgBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 96, 0.55);
      // Firebase Auth tiene un límite práctico de ~2 KB en photoURL.
      // Si nos pasamos, bajamos calidad y reintentamos.
      let final = dataUrl;
      if (final.length > 2000) {
        final = await resizeImageToDataUrl(file, 80, 0.45);
      }
      if (final.length > 2000) {
        setError(
          'La imagen es demasiado grande. Prueba con otra más simple — todavía no tenemos almacenamiento para fotos en alta resolución.',
        );
        return;
      }
      setPhotoUrl(final);
    } catch (err) {
      console.error('[BTal] resize image error:', err);
      setError('No hemos podido procesar la imagen.');
    } finally {
      setImgBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
  };

  // Base canónica del nombre para comparar (lo que ya está en perfil ·
  // misma fuente que el input inicial · evita falso "dirty" cuando solo
  // Auth.displayName diverge del perfil).
  const baseName =
    userDoc?.profile?.nombre?.trim() || user.displayName?.trim() || null;

  const handleSave = () => {
    setError('');
    // Normalizamos el nombre a Title Case ANTES del diff y del save · así
    // el `ConfirmDiffAlert` ya muestra cómo va a quedar persistido (no
    // como el user lo tipeó). Coherente con `saveOnboardingProfile` y
    // `updateUserProfileFields`, que también canonicalizan al guardar.
    const cleaned = {
      name: toTitleCase(name) || null,
      photoUrl: photoUrl ?? null,
    };
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Nombre', baseName, cleaned.name);
    const beforePhoto = user.photoURL ?? null;
    if (beforePhoto !== cleaned.photoUrl) {
      changes.push({
        label: 'Foto',
        from: beforePhoto ? 'Definida' : '—',
        to: cleaned.photoUrl ? 'Cambiada' : '—',
      });
    }
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    setBusy(true);
    try {
      // 1) Auth · displayName + photoURL (sigue siendo la fuente para Google
      // OAuth scopes y servicios externos).
      await updateUserProfile(user, {
        displayName: cleaned.name,
        photoURL: cleaned.photoUrl,
      });
      // 2) Firestore · sincroniza `profile.nombre` con el mismo valor para
      // que la UI interna (avatar/saludo/Settings) tenga una sola fuente.
      // `updateUserProfileFields` además vuelve a llamar a syncAuthDisplayName,
      // que es idempotente (no-op si ya coincide tras paso 1).
      if (cleaned.name !== (userDoc?.profile?.nombre?.trim() || null)) {
        await updateProfileDoc({ nombre: cleaned.name ?? '' });
      }
      // refreshUser propaga el cambio (avatar/nombre) al Dashboard, Settings,
      // AccountInfoModal — todos los consumidores de AuthContext.
      await refreshUser();
      onClose();
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  // Cambios sin guardar · comparamos con la base canónica (no con Auth a
  // pelo) para no marcar dirty cuando solo había drift Auth vs profile.
  const dirty =
    (name.trim() || null) !== baseName ||
    (photoUrl ?? null) !== (user.photoURL ?? null);

  return (
    <>
    <IonModal
      isOpen={isOpen}
      onWillPresent={resetState}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      <div className="settings-modal-bg">
        <div className="settings-modal-card">
          {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
          <button
            type="button"
            className="settings-modal-close"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <MealIcon value="tb:x" size={22} />
          </button>
          <h2 className="settings-modal-title">Editar perfil</h2>

          <div className="profile-avatar-wrap">
            <div className="profile-avatar-big">
              {imgBusy ? (
                <IonSpinner name="dots" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="Foto de perfil" />
              ) : (
                <span className="profile-avatar-initials">
                  {initialsOf(name || user.displayName, user.email)}
                </span>
              )}
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="profile-pic-btn"
                onClick={() => cameraRef.current?.click()}
                disabled={imgBusy}
              >
                <MealIcon value="tb:camera" size={18} />
                Tomar foto
              </button>
              <button
                type="button"
                className="profile-pic-btn"
                onClick={() => galleryRef.current?.click()}
                disabled={imgBusy}
              >
                <MealIcon value="tb:photo" size={18} />
                Elegir de galería
              </button>
              {photoUrl && (
                <button
                  type="button"
                  className="profile-pic-btn profile-pic-btn--danger"
                  onClick={handleRemovePhoto}
                  disabled={imgBusy}
                >
                  <MealIcon value="tb:trash" size={18} />
                  Quitar foto
                </button>
              )}
            </div>
            {/* En PWA web estos inputs disparan el picker nativo del SO.
                Cuando pasemos a Capacitor nativo (Fase 9) esto cambia a
                @capacitor/camera con permisos en Info.plist (iOS) y
                AndroidManifest.xml (Android). */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>

          <div className="landing-input-wrap">
            <input
              className="landing-input"
              type="text"
              placeholder="Tu nombre"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              style={{ paddingLeft: 16 }}
            />
          </div>

          <p className="landing-hint">
            La foto se guardará comprimida en tu cuenta de Firebase Auth (96×96 px). Cuando
            activemos Storage podrás subir imágenes en alta resolución.
          </p>

          {error && <div className="landing-msg error">{error}</div>}

          <IonButton
            type="button"
            expand="block"
            className="settings-modal-primary"
            onClick={handleSave}
            disabled={busy || imgBusy || !dirty}
          >
            {busy ? <IonSpinner name="dots" /> : 'Guardar'}
          </IonButton>
        </div>
      </div>
    </IonModal>

    <ConfirmDiffAlert
      pending={confirmChanges}
      onCancel={() => setConfirmChanges(null)}
      onConfirm={() => {
        persistConfirmed().catch((err) =>
          console.error('[BTal] persistConfirmed user profile:', err),
        );
      }}
    />
    </>
  );
}
