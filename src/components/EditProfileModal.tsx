import { useRef, useState, type ChangeEvent } from 'react';
import { IonButton, IonIcon, IonModal, IonSpinner } from '@ionic/react';
import {
  cameraOutline,
  closeOutline,
  imageOutline,
  trashOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { updateUserProfile } from '../services/auth';
import { resizeImageToDataUrl } from '../utils/resizeImage';
import './SettingsModal.css';
import './EditProfileModal.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  // Para que el padre fuerce re-render tras updateProfile (el objeto User
  // mutará in-place pero React no se entera).
  onUpdated?: () => void;
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

// Si el name está vacío, usamos las iniciales del email.
function initialsOf(user: User, name?: string | null) {
  const source = (name?.trim() || user.displayName?.trim() || user.email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

export function EditProfileModal({ isOpen, user, onClose, onUpdated }: Props) {
  const [name, setName] = useState(user.displayName ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photoURL ?? null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState('');

  // Dos inputs distintos: galería y cámara. En móvil con `capture` el SO
  // abre la cámara directamente; sin `capture` deja elegir de galería.
  // En desktop ambos abren un selector de archivos.
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setName(user.displayName ?? '');
    setPhotoUrl(user.photoURL ?? null);
    setBusy(false);
    setImgBusy(false);
    setError('');
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
    } catch {
      setError('No hemos podido procesar la imagen.');
    } finally {
      setImgBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
  };

  const handleSave = async () => {
    setError('');
    setBusy(true);
    try {
      await updateUserProfile(user, {
        displayName: name.trim() || null,
        photoURL: photoUrl,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      setError(translateError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  // Cambios sin guardar (compara con valores actuales del user)
  const dirty =
    (name.trim() || null) !== (user.displayName?.trim() || null) ||
    (photoUrl ?? null) !== (user.photoURL ?? null);

  return (
    <IonModal
      isOpen={isOpen}
      onWillPresent={resetState}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      <div className="settings-modal-bg">
        <button
          type="button"
          className="settings-modal-close"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <div className="settings-modal-card">
          <h2 className="settings-modal-title">Editar perfil</h2>

          <div className="profile-avatar-wrap">
            <div className="profile-avatar-big">
              {imgBusy ? (
                <IonSpinner name="dots" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="Foto de perfil" />
              ) : (
                <span className="profile-avatar-initials">{initialsOf(user, name)}</span>
              )}
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="profile-pic-btn"
                onClick={() => cameraRef.current?.click()}
                disabled={imgBusy}
              >
                <IonIcon icon={cameraOutline} />
                Tomar foto
              </button>
              <button
                type="button"
                className="profile-pic-btn"
                onClick={() => galleryRef.current?.click()}
                disabled={imgBusy}
              >
                <IonIcon icon={imageOutline} />
                Elegir de galería
              </button>
              {photoUrl && (
                <button
                  type="button"
                  className="profile-pic-btn profile-pic-btn--danger"
                  onClick={handleRemovePhoto}
                  disabled={imgBusy}
                >
                  <IonIcon icon={trashOutline} />
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
  );
}
