import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  checkmarkCircleOutline,
  closeOutline,
  copyOutline,
  warningOutline,
} from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { SaveIndicator } from './SaveIndicator';
import {
  DAY_KEYS,
  type DayKey,
  type MealKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './DuplicateMealModal.css';

const DAY_LABEL_FULL: Record<DayKey, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Día y meal de la comida origen · meal-key se mantiene en los destinos
  // (Desayuno → Desayuno) por decisión de producto en 2B.4. La comida en
  // sí no la pasamos como prop · el provider la lee del state actual al
  // ejecutar duplicateMeal, así garantizamos que copiamos la versión más
  // reciente aunque el user haya editado justo antes de duplicar.
  srcDay: DayKey;
  meal: MealKey;
  // Map { day → tieneDatos }. Lo recibimos desde MenuPage que ya tiene el
  // doc cargado · evita pasar el doc completo o re-leerlo aquí.
  daysWithData: Record<DayKey, boolean>;
}

// Modal de duplicación · Sub-fase 2B.4. El user marca con checkboxes los
// días destino y pulsa "Duplicar". Si alguno de esos días ya tiene comida
// en el mismo slot (alimentos.length > 0), pedimos confirmación antes de
// sobrescribir.
//
// Decisiones:
//   - meal-key fija (la origen) · simple y útil para meal-prep semanal.
//   - El día origen se muestra deshabilitado · no tiene sentido duplicar
//     sobre sí mismo.
//   - Source pasa a 'user' en todos los destinos · duplicar es manual.
export function DuplicateMealModal({
  isOpen,
  onClose,
  srcDay,
  meal,
  daysWithData,
}: Props) {
  const { duplicateMeal } = useProfile();

  // Set de días seleccionados como destino. Arranca vacío en cada apertura.
  const [selected, setSelected] = useState<Set<DayKey>>(new Set());
  const [savedToast, setSavedToast] = useState(false);
  const [overwriteAlertOpen, setOverwriteAlertOpen] = useState(false);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  // Cleanup del setTimeout post-éxito (evita disparar tras unmount).
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reset al abrir el modal.
  const resetState = () => {
    setSelected(new Set());
    setSavedToast(false);
    setOverwriteAlertOpen(false);
    resetSave();
  };

  // Días destino · todos menos el origen, en el orden lun→dom estable.
  const destDays = useMemo(
    () => DAY_KEYS.filter((d) => d !== srcDay),
    [srcDay],
  );

  // ¿Cuántos de los seleccionados sobrescribirían datos existentes?
  const overwriteCount = useMemo(() => {
    let n = 0;
    for (const day of selected) {
      if (daysWithData[day]) n += 1;
    }
    return n;
  }, [selected, daysWithData]);

  const toggleDay = (day: DayKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // Guardado real · una llamada al provider que aplica optimistic + write
  // batch a Firestore.
  const persist = async () => {
    const targets = Array.from(selected);
    if (targets.length === 0 || submitting) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() =>
      duplicateMeal(srcDay, meal, targets),
    );
    if (result === SAVE_FAILED) return; // falló · SaveIndicator muestra Error 3s
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  const handleSavePress = () => {
    if (selected.size === 0 || submitting) return;
    if (overwriteCount > 0) {
      // Hay días con datos · pedimos confirmación antes de sobrescribir.
      setOverwriteAlertOpen(true);
      return;
    }
    persist().catch((err) => {
      console.error('[BTal] duplicateMeal unhandled:', err);
    });
  };

  const buttonLabel =
    selected.size === 0
      ? 'Selecciona uno o más días'
      : selected.size === 1
      ? 'Duplicar a 1 día'
      : `Duplicar a ${selected.size} días`;

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
                Duplicar {MEAL_LABEL[meal].toLowerCase()}
              </h2>
              <p className="settings-modal-text">
                Vamos a copiar tu {MEAL_LABEL[meal].toLowerCase()} del{' '}
                {DAY_LABEL_FULL[srcDay].toLowerCase()} al mismo slot de los
                días que marques. Los macros y los alimentos se copian
                exactamente.
              </p>

              <div className="dup-list" role="group" aria-label="Días destino">
                {destDays.map((day) => {
                  const checked = selected.has(day);
                  const occupied = daysWithData[day];
                  return (
                    <label
                      key={day}
                      className={
                        'dup-row'
                        + (checked ? ' active' : '')
                        + (occupied ? ' occupied' : '')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDay(day)}
                        aria-label={DAY_LABEL_FULL[day]}
                      />
                      <span className="dup-row-day">{DAY_LABEL_FULL[day]}</span>
                      {occupied && (
                        <span className="dup-row-occupied">
                          <IonIcon icon={warningOutline} />
                          Ya tiene comida
                        </span>
                      )}
                      {checked && !occupied && (
                        <IonIcon
                          className="dup-row-check"
                          icon={checkmarkCircleOutline}
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              {overwriteCount > 0 && (
                <p className="dup-warning">
                  <IonIcon icon={warningOutline} />
                  Sobrescribirás {overwriteCount === 1
                    ? '1 comida que ya tienes'
                    : `${overwriteCount} comidas que ya tienes`}.
                  Te lo confirmaremos antes de guardar.
                </p>
              )}

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
                disabled={selected.size === 0 || submitting}
              >
                <IonIcon icon={copyOutline} slot="start" />
                {buttonLabel}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Confirmación al sobrescribir días con comida ya rellenada. */}
      <IonAlert
        isOpen={overwriteAlertOpen}
        onDidDismiss={() => setOverwriteAlertOpen(false)}
        header="¿Sobrescribir comidas existentes?"
        message={
          overwriteCount === 1
            ? 'Uno de los días seleccionados ya tiene una comida en este slot. Si continúas, la reemplazaremos por la copia.'
            : `${overwriteCount} de los días seleccionados ya tienen comida en este slot. Si continúas, las reemplazaremos por la copia.`
        }
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Sobrescribir',
            role: 'confirm',
            handler: () => {
              persist().catch((err) => {
                console.error('[BTal] duplicateMeal unhandled:', err);
              });
            },
          },
        ]}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message={
          selected.size === 1
            ? 'Comida duplicada'
            : `Duplicada en ${selected.size} días`
        }
        duration={2000}
        position="bottom"
        color="success"
      />
    </>
  );
}
