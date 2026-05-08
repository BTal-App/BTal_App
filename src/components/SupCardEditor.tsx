import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  closeOutline,
  removeCircleOutline,
} from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { SaveIndicator } from './SaveIndicator';
import {
  SUP_HORA_DEFECTO,
  SUP_TITULO_DEFECTO,
  type DayKey,
  type SupDayOverride,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';

const DAY_LABEL_FULL: Record<DayKey, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Día y suplemento que estamos editando.
  day: DayKey;
  kind: 'batido' | 'creatina';
}

// Editor de mini-card · Sub-fase 2B.5.a (extensión post-feedback). Permite
// override del título y la hora SOLO para ese día concreto. Si el user
// vacía ambos campos, guardamos null y la mini-card vuelve a los defaults
// globales. También botón "Quitar del día" para eliminar la mini-card.
export function SupCardEditor({ isOpen, onClose, day, kind }: Props) {
  const {
    profile: userDoc,
    setSupOverride,
    toggleSupInDay,
  } = useProfile();
  const overrides =
    kind === 'batido'
      ? userDoc?.suplementos.batidoOverrides
      : userDoc?.suplementos.creatinaOverrides;
  const current = overrides?.[day];

  // Defaults para placeholder · usados también si el user vacía el campo.
  const defaultHora =
    kind === 'batido' ? SUP_HORA_DEFECTO.batido : SUP_HORA_DEFECTO.creatina;
  const defaultTitulo =
    kind === 'batido'
      ? SUP_TITULO_DEFECTO.batido
      : SUP_TITULO_DEFECTO.creatina;

  // Form state · arranca con los valores override (o defaults si no hay).
  const [titulo, setTitulo] = useState(current?.titulo ?? '');
  const [hora, setHora] = useState(current?.hora ?? defaultHora);

  const [savedToast, setSavedToast] = useState(false);
  const [removedToast, setRemovedToast] = useState(false);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  const [removing, setRemoving] = useState(false);

  // Cleanup del setTimeout post-éxito.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset al abrir · siempre arrancamos con la versión del doc actual.
  const resetState = () => {
    setTitulo(current?.titulo ?? '');
    setHora(current?.hora ?? defaultHora);
    setSavedToast(false);
    setRemovedToast(false);
    resetSave();
  };

  // Validación de hora · acepta HH:mm en 24h, vacío también vale (default).
  const horaValida =
    hora === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);

  const handleSave = async () => {
    if (!horaValida || submitting) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);

    // Construimos el override · solo guardamos campos que se desvían del
    // default. Si ambos coinciden con el default, guardamos null para
    // borrar la entrada y mantener Firestore limpio.
    const tituloFinal = titulo.trim();
    const tituloDeviates =
      tituloFinal !== '' && tituloFinal !== defaultTitulo;
    const horaFinal = hora.trim();
    const horaDeviates = horaFinal !== '' && horaFinal !== defaultHora;

    const override: SupDayOverride | null =
      tituloDeviates || horaDeviates
        ? {
            titulo: tituloDeviates ? tituloFinal : null,
            hora: horaDeviates ? horaFinal : null,
          }
        : null;

    const result = await runSave(() =>
      setSupOverride(kind, day, override),
    );
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  // Quitar del día · llamamos a toggleSupInDay con on=false. También
  // borramos cualquier override existente (no tiene sentido que persistan
  // sin el día activo). Cerramos el modal y mostramos toast.
  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await toggleSupInDay(kind, day, false);
      // Si había override, limpiamos también · idempotente si no había.
      if (current !== undefined) {
        await setSupOverride(kind, day, null);
      }
      setRemovedToast(true);
      onClose();
    } catch (err) {
      console.error('[BTal] handleRemove sup error:', err);
    } finally {
      setRemoving(false);
    }
  };

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
              <h2
                className={
                  'settings-modal-title '
                  + (kind === 'batido' ? 'sup-title-batido' : 'sup-title-creatina')
                }
              >
                {kind === 'batido' ? '🥤 Editar batido' : '🥄 Editar creatina'}
              </h2>
              <p className="settings-modal-text">
                Ajusta la hora y el título solo para el{' '}
                {DAY_LABEL_FULL[day].toLowerCase()}. Si los dejas en blanco
                usaremos los valores por defecto.
              </p>

              <div className="sup-form-group">
                <label className="sup-label">Título</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={50}
                  placeholder={defaultTitulo}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Hora</label>
                <input
                  className="sup-input"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
                {!horaValida && (
                  <span className="sup-input-error">Formato HH:mm</span>
                )}
              </div>

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleSave();
                }}
                disabled={!horaValida || submitting}
              >
                Guardar cambios
              </IonButton>

              <div className="sup-divider" aria-hidden="true" />

              <button
                type="button"
                className="sup-day-btn sup-day-btn--remove"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleRemove();
                }}
                disabled={removing}
              >
                <IonIcon icon={removeCircleOutline} />
                Quitar del {DAY_LABEL_FULL[day].toLowerCase()}
              </button>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Mini-card actualizada"
        duration={2000}
        position="bottom"
        color="success"
      />
      <IonToast
        isOpen={removedToast}
        onDidDismiss={() => setRemovedToast(false)}
        message={
          kind === 'batido'
            ? 'Batido quitado del día'
            : 'Creatina quitada del día'
        }
        duration={2000}
        position="bottom"
        color="medium"
      />
    </>
  );
}
