import { useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { checkmarkCircle, closeOutline } from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import { StepMode, type StepModeValue } from './StepMode';
import { blurAndRun } from '../utils/focus';
import './SettingsModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal accesible desde Settings → Administrar cuenta → "Modo de
// generación". Permite al usuario cambiar entre IA y Manual sin perder
// los datos que ya tenga (menú/entrenos/compra).
//
// Cuando el cambio es manual → ai mostramos un IonAlert de confirmación
// que avisa de que aparecerán botones "Generar con IA" en cada tab.
// Decisión de UX: el cambio NO dispara una generación automática — solo
// desbloquea la UI. La generación real la dispara el usuario desde los
// botones de cada tab (Hoy/Menú/Entreno).
export function ChangeModeModal({ isOpen, onClose }: Props) {
  const { profile: userDoc, updateProfile } = useProfile();
  const currentModo = userDoc?.profile?.modo ?? 'manual';
  const currentScope = userDoc?.profile?.aiScope ?? null;

  // El estado interno usa la firma del StepMode (objeto modo+aiScope).
  const [selected, setSelected] = useState<StepModeValue>({
    modo: currentModo,
    aiScope: currentScope,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  // Aviso de confirmación al activar IA · solo si el cambio es manual→ai.
  const [confirmEnableAiOpen, setConfirmEnableAiOpen] = useState(false);

  // Reset del estado al abrir · cogemos los valores guardados como punto
  // de partida. Si el user reabre el modal tras cancelar arranca limpio.
  const resetState = () => {
    setSelected({
      modo: userDoc?.profile?.modo ?? 'manual',
      aiScope: userDoc?.profile?.aiScope ?? null,
    });
    setError('');
  };

  // ¿Hay cambios respecto a lo guardado?
  const dirty =
    selected.modo !== currentModo || selected.aiScope !== currentScope;

  // Validación: manual no necesita scope. ai necesita scope elegido.
  const valid =
    selected.modo === 'manual'
    || (selected.modo === 'ai' && selected.aiScope !== null);

  // ¿Es un cambio que activa IA por primera vez (manual → ai)?
  const isEnablingAi = currentModo === 'manual' && selected.modo === 'ai';

  const handleSavePress = () => {
    if (!dirty || !valid || submitting) return;
    if (isEnablingAi) {
      // Antes de guardar pedimos confirmación con un alert · el user
      // tiene que entender qué cambia visualmente al activar IA.
      setConfirmEnableAiOpen(true);
      return;
    }
    // Cambio que NO activa IA (ai→ai con scope distinto, o ai→manual,
    // o manual→manual sin más): guardamos directamente. Capturamos
    // cualquier rechazo no atrapado por persistChange() para no dejar
    // promises sin manejar (silenciadas por el motor).
    persistChange().catch((err) => {
      console.error('[BTal] persistChange unhandled:', err);
    });
  };

  const persistChange = async () => {
    if (!dirty || !valid || submitting || selected.modo === null) return;
    setError('');
    setSubmitting(true);
    try {
      // Guardamos modo + aiScope a la vez. Si pasa a manual, aiScope=null
      // (StepMode lo asegura por construcción).
      await updateProfile({
        modo: selected.modo,
        aiScope: selected.aiScope,
      });
      setSavedToast(true);
      onClose();
    } catch (err) {
      console.error('[BTal] updateMode error:', err);
      setError('No hemos podido cambiar el modo. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
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
          onClick={blurAndRun(onClose)}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              <h2 className="settings-modal-title">Modo de generación</h2>
              <p className="settings-modal-text">
                Elige cómo se construye tu plan. Puedes cambiar de modo en
                cualquier momento sin perder los datos que ya tengas.
              </p>

              <StepMode
                value={selected}
                onChange={setSelected}
                variant="compact"
              />

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={blurAndRun(handleSavePress)}
                disabled={!dirty || !valid || submitting}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={checkmarkCircle} slot="start" />
                    Guardar cambio
                  </>
                )}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Aviso al activar IA · solo cuando el cambio es manual → ai.
          Al confirmar, persistChange() guarda y cierra el modal. */}
      <IonAlert
        isOpen={confirmEnableAiOpen}
        onDidDismiss={() => setConfirmEnableAiOpen(false)}
        header="¿Activar la generación con IA?"
        message={
          'A partir de ahora aparecerán botones "Generar con IA" en las pestañas Hoy, Menú y Entreno. ' +
          'Podrás generar tu plan en cualquier momento sin perder los datos que ya tengas. ' +
          'Recuerda: en plan Free tienes 1 generación al mes (sea total o parcial).'
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Activar IA',
            role: 'confirm',
            handler: () => {
              persistChange().catch((err) => {
                console.error('[BTal] persistChange unhandled:', err);
              });
            },
          },
        ]}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Modo de generación actualizado"
        duration={2000}
        position="bottom"
        color="success"
      />
    </>
  );
}
