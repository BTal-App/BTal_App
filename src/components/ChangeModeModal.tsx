import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { SaveIndicator } from './SaveIndicator';
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
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  // Status del guardado · sincronizado con el await a updateProfile.
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  // Aviso de confirmación al activar IA · solo si el cambio es manual→ai.
  const [confirmEnableAiOpen, setConfirmEnableAiOpen] = useState(false);
  // Cleanup del setTimeout post-éxito (evita disparar tras unmount).
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset del estado al abrir · cogemos los valores guardados como punto
  // de partida. Si el user reabre el modal tras cancelar arranca limpio.
  const resetState = () => {
    setSelected({
      modo: userDoc?.profile?.modo ?? 'manual',
      aiScope: userDoc?.profile?.aiScope ?? null,
    });
    setError('');
    resetSave();
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
    // Capturamos los valores fuera del closure · el narrowing de
    // `selected.modo !== null` no se propaga dentro de la lambda async.
    const modoToSave = selected.modo;
    const aiScopeToSave = selected.aiScope;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() =>
      updateProfile({
        modo: modoToSave,
        aiScope: aiScopeToSave,
      }),
    );
    if (result === SAVE_FAILED) {
      setError('No hemos podido cambiar el modo. Inténtalo de nuevo.');
      return;
    }
    // Tras éxito esperamos a que el chip "Guardado" se vea antes de cerrar.
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={blurAndRun(onClose)}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
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

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleSavePress();
                }}
                disabled={!dirty || !valid || submitting}
              >
                <MealIcon value="tb:circle-check-filled" size={18} slot="start" />
                Guardar cambio
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
          'El botón «Generar con IA» estará disponible en los menús Hoy, Menú y Entreno. ' +
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
