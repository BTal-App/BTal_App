import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { blurAndRun } from '../utils/focus';
import { SaveIndicator } from './SaveIndicator';
import { EmojiPicker } from './EmojiPicker';
import {
  newCompraCategoriaId,
  type CategoriaCompra,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';
import './CompraCategoriaEditorModal.css';

// Modal para añadir/editar/eliminar una categoría de la lista de la
// compra · réplica de la "edición de categorías" del v1. Las
// categorías builtIn (proteinas/lacteos/...) NO se pueden eliminar
// pero sí renombrar y cambiar emoji/color.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Si se pasa categoria, modo edit. Si no, modo create.
  categoria?: CategoriaCompra;
}

const NOMBRE_MAX = 30;

// Paleta de acentos disponibles · usa los tokens BTal de variables.css.
// Coherente con el resto de la app · evita que el user elija colores
// random que choquen con el tema.
const COLORES: { value: string; label: string }[] = [
  { value: 'var(--btal-lime)', label: 'Lima' },
  { value: 'var(--btal-cyan)', label: 'Cian' },
  { value: 'var(--btal-blue)', label: 'Azul' },
  { value: 'var(--btal-violet)', label: 'Violeta' },
  { value: 'var(--btal-coral)', label: 'Coral' },
  { value: 'var(--btal-gold)', label: 'Dorado' },
];

export function CompraCategoriaEditorModal({
  isOpen,
  onClose,
  categoria,
}: Props) {
  const isEdit = !!categoria;
  const isBuiltIn = categoria?.builtIn === true;
  const {
    addCompraCategoria,
    updateCompraCategoria,
    removeCompraCategoria,
    restoreCompraCategoria,
  } = useProfile();

  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [emoji, setEmoji] = useState(categoria?.emoji ?? '🛒');
  const [color, setColor] = useState(categoria?.color ?? COLORES[0].value);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: { nombre: string; emoji: string; color: string };
  } | null>(null);
  const [undoToast, setUndoToast] = useState<{
    categoria: CategoriaCompra;
    items: typeof categoria extends undefined ? never : import('../templates/defaultUser').ItemCompra[];
  } | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  const resetState = () => {
    setNombre(categoria?.nombre ?? '');
    setEmoji(categoria?.emoji ?? '🛒');
    setColor(categoria?.color ?? COLORES[0].value);
    setEmojiPickerOpen(false);
    setConfirmDeleteOpen(false);
    setConfirmChanges(null);
    resetSave();
  };

  // Timer del cierre tras "Guardado ✓" · réplica de MealEditor para
  // que el chip sea visible 500ms antes de cerrar el modal.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleSave = () => {
    if (submitting) return;
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) return;

    const cleaned = { nombre: trimmedNombre, emoji, color };

    const changes: ChangeEntry[] = [];
    if (isEdit && categoria) {
      pushDiff(changes, 'Nombre', categoria.nombre, cleaned.nombre);
      pushDiff(changes, 'Emoji', categoria.emoji, cleaned.emoji);
      pushDiff(changes, 'Color', categoria.color, cleaned.color);
    } else {
      changes.push({ label: 'Nombre', from: '—', to: cleaned.nombre });
      changes.push({ label: 'Emoji', from: '—', to: cleaned.emoji });
      changes.push({ label: 'Color', from: '—', to: cleaned.color });
    }
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);

    let result;
    if (isEdit && categoria) {
      result = await runSave(() =>
        updateCompraCategoria(categoria.id, {
          nombre: cleaned.nombre,
          emoji: cleaned.emoji,
          color: cleaned.color,
        }),
      );
    } else {
      const newCat: CategoriaCompra = {
        id: newCompraCategoriaId(),
        nombre: cleaned.nombre,
        emoji: cleaned.emoji,
        color: cleaned.color,
        order: 999, // se renumera en server-side cuando se reordena
        builtIn: false,
      };
      result = await runSave(() => addCompraCategoria(newCat));
    }
    if (result === SAVE_FAILED) return;
    // Espera a que el chip "Guardado ✓" sea visible antes de cerrar
    // (réplica del MealEditor · usa SAVED_INDICATOR_MS = 500ms).
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  const handleDelete = async () => {
    if (!categoria || isBuiltIn) return;
    setConfirmDeleteOpen(false);
    try {
      const removed = await removeCompraCategoria(categoria.id);
      onClose();
      if (!removed) return;
      setUndoToast(removed);
    } catch (err) {
      console.error('[BTal] removeCompraCategoria error:', err);
    }
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    const snap = undoToast;
    setUndoToast(null);
    try {
      await restoreCompraCategoria(snap.categoria, snap.items);
    } catch (err) {
      console.error('[BTal] restoreCompraCategoria error:', err);
    }
  };

  const canSave = nombre.trim().length > 0 && !submitting;

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <button
          type="button"
          className="settings-modal-close settings-modal-close--fixed"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            onClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              <h2 className="settings-modal-title">
                {emoji} {isEdit ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              {isBuiltIn && (
                <p className="settings-modal-text">
                  Esta categoría es de las predeterminadas · puedes
                  renombrarla y cambiar emoji/color, pero no eliminarla.
                </p>
              )}

              <div className="sup-form-group">
                <label className="sup-label">Nombre</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={NOMBRE_MAX}
                  placeholder="Frutas y verduras"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoFocus={!isEdit}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Icono</label>
                <button
                  type="button"
                  className="cat-editor-emoji-btn"
                  onClick={blurAndRun(() => setEmojiPickerOpen(true))}
                  aria-label="Cambiar icono"
                >
                  <span className="cat-editor-emoji-preview">{emoji}</span>
                  <span className="cat-editor-emoji-hint">
                    Pulsa para elegir otro
                  </span>
                </button>
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Color de acento</label>
                <div className="cat-editor-colors">
                  {COLORES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={
                        'cat-editor-color'
                        + (c.value === color ? ' cat-editor-color--active' : '')
                      }
                      style={{ background: c.value }}
                      onClick={(e) => {
                        (e.currentTarget as HTMLElement).blur();
                        setColor(c.value);
                      }}
                      aria-label={c.label}
                      aria-pressed={c.value === color}
                    />
                  ))}
                </div>
              </div>

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <div className="sup-actions">
                <IonButton
                  type="button"
                  fill="outline"
                  className="sup-action-cancel"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    onClose();
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </IonButton>
                <IonButton
                  type="button"
                  className="settings-modal-primary"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    handleSave();
                  }}
                  disabled={!canSave}
                >
                  {isEdit ? 'Guardar' : 'Crear'}
                </IonButton>
              </div>

              {isEdit && !isBuiltIn && (
                <>
                  <div className="sup-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="sup-day-btn sup-day-btn--remove"
                    onClick={blurAndRun(() => setConfirmDeleteOpen(true))}
                    disabled={submitting}
                  >
                    <IonIcon icon={trashOutline} />
                    Eliminar categoría
                  </button>
                </>
              )}
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Picker de emojis · reutiliza el de comidas. */}
      {emojiPickerOpen && (
        <IonModal
          isOpen={emojiPickerOpen}
          onDidDismiss={() => setEmojiPickerOpen(false)}
          className="settings-modal cat-editor-emoji-modal"
        >
          <IonContent>
            <div className="cat-editor-emoji-modal-content">
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={blurAndRun(() => setEmojiPickerOpen(false))}
                aria-label="Cerrar"
              >
                <IonIcon icon={closeOutline} />
              </button>
              <h3 className="cat-editor-emoji-modal-title">Elige un icono</h3>
              <EmojiPicker
                selected={emoji}
                onSelect={(e) => {
                  setEmoji(e);
                  setEmojiPickerOpen(false);
                }}
              />
            </div>
          </IonContent>
        </IonModal>
      )}

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed cat:', err),
          );
        }}
      />

      <IonAlert
        isOpen={confirmDeleteOpen}
        onDidDismiss={() => setConfirmDeleteOpen(false)}
        header="¿Eliminar categoría?"
        message={`Se eliminará "${categoria?.nombre ?? ''}" y los productos que tenga dentro. Tendrás 5 segundos para deshacer.`}
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              handleDelete();
            },
          },
        ]}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message={isEdit ? 'Categoría actualizada' : 'Categoría creada'}
        duration={1500}
        position="bottom"
        color="success"
      />

      <IonToast
        isOpen={undoToast !== null}
        onDidDismiss={() => setUndoToast(null)}
        message={
          undoToast
            ? `Categoría "${undoToast.categoria.nombre}" eliminada`
            : ''
        }
        duration={5000}
        position="bottom"
        color="medium"
        buttons={[
          {
            text: 'Deshacer',
            role: 'cancel',
            handler: () => {
              handleUndo().catch((err) =>
                console.error('[BTal] handleUndo cat error:', err),
              );
            },
          },
        ]}
      />
    </>
  );
}
