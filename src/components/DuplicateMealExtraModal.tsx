import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import {
  DAY_KEYS,
  DAY_LABEL_FULL,
  MAX_EXTRAS_POR_DIA,
  type ComidaExtra,
  type DayKey,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './DuplicateMealModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Día y extra origen · el extra se pasa entero para mostrar nombre
  // y para que el caller no tenga que re-leerlo del doc al persistir.
  srcDay: DayKey;
  extra: ComidaExtra;
  // Map { day → nº de extras actuales en ese día }. Lo usamos para
  // deshabilitar las filas de días que ya están al límite (8/8) y
  // mostrar el contador "n/8". El caller (MenuPage) ya tiene el doc.
  extrasCountByDay: Record<DayKey, number>;
}

// Modal de duplicación de un extra · gemelo de DuplicateMealModal pero
// adaptado al modelo de `ComidaExtra` (array por día, no slot fijo).
//
// Decisiones:
//   - No hay riesgo de "sobrescribir" porque los extras se añaden a
//     una lista. Sí hay un límite duro: MAX_EXTRAS_POR_DIA (8) ·
//     filas de días llenos se renderizan deshabilitadas.
//   - Cada destino recibe una copia con `newExtraId()` (provider) ·
//     editar/borrar en un día no afecta a los demás.
//   - El día origen se omite de la lista · duplicar sobre sí mismo no
//     tiene sentido (sería simplemente "add").
export function DuplicateMealExtraModal({
  isOpen,
  onClose,
  srcDay,
  extra,
  extrasCountByDay,
}: Props) {
  const { duplicateMealExtra } = useProfile();

  const [selected, setSelected] = useState<Set<DayKey>>(new Set());
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const resetState = () => {
    setSelected(new Set());
    setSavedToast(null);
    resetSave();
  };

  // Días destino · todos menos el origen.
  const destDays = useMemo(
    () => DAY_KEYS.filter((d) => d !== srcDay),
    [srcDay],
  );

  const toggleDay = (day: DayKey) => {
    // Días al límite no se pueden marcar · click no-op (la fila se
    // renderiza con `disabled` de todas formas).
    if ((extrasCountByDay[day] ?? 0) >= MAX_EXTRAS_POR_DIA) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const persist = async () => {
    const targets = Array.from(selected);
    if (targets.length === 0 || submitting) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() =>
      duplicateMealExtra(srcDay, extra.id, targets),
    );
    if (result === SAVE_FAILED) {
      setErrorToast('No se pudo duplicar la comida. Inténtalo de nuevo.');
      return;
    }
    // result puede tener `skipped` (días al límite) pero la UI ya los
    // ha deshabilitado, así que en el caso normal `added.length ===
    // selected.size`. Construimos el mensaje del toast basándonos en
    // los que sí se añadieron.
    const added = (result as { added: DayKey[]; skipped: DayKey[] }).added;
    closeTimer.current = setTimeout(() => {
      setSavedToast(
        added.length === 1
          ? 'Comida duplicada'
          : `Duplicada en ${added.length} días`,
      );
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  const handleSavePress = () => {
    if (selected.size === 0 || submitting) return;
    persist().catch((err) => {
      console.error('[BTal] duplicateMealExtra unhandled:', err);
    });
  };

  const nombre = extra.nombre.trim() || 'Comida';
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
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  onClose();
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
              <h2 className="settings-modal-title">
                Duplicar {nombre.toLowerCase()}
              </h2>
              <p className="settings-modal-text">
                Vamos a añadir una copia de tu {nombre.toLowerCase()} del{' '}
                {DAY_LABEL_FULL[srcDay].toLowerCase()} en los días que
                marques. Cada copia se guarda como una comida nueva
                independiente — editar o borrar una no afecta al resto.
              </p>

              <div className="dup-list" role="group" aria-label="Días destino">
                {destDays.map((day) => {
                  const count = extrasCountByDay[day] ?? 0;
                  const full = count >= MAX_EXTRAS_POR_DIA;
                  const checked = selected.has(day);
                  return (
                    <label
                      key={day}
                      className={
                        'dup-row'
                        + (checked ? ' active' : '')
                        + (full ? ' occupied' : '')
                      }
                      aria-disabled={full ? 'true' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={full}
                        onChange={() => toggleDay(day)}
                        aria-label={DAY_LABEL_FULL[day]}
                      />
                      <span className="dup-row-day">{DAY_LABEL_FULL[day]}</span>
                      {full ? (
                        <span className="dup-row-occupied">
                          <MealIcon value="tb:alert-triangle" size={14} />
                          Lleno ({count}/{MAX_EXTRAS_POR_DIA})
                        </span>
                      ) : (
                        <span className="dup-row-day-count">
                          {count}/{MAX_EXTRAS_POR_DIA}
                        </span>
                      )}
                      {checked && !full && (
                        <MealIcon
                          value="tb:circle-check"
                          size={20}
                          className="dup-row-check"
                        />
                      )}
                    </label>
                  );
                })}
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
                  handleSavePress();
                }}
                disabled={selected.size === 0 || submitting}
              >
                <MealIcon value="tb:copy" size={18} slot="start" />
                {buttonLabel}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={savedToast !== null}
        onDidDismiss={() => setSavedToast(null)}
        message={savedToast ?? ''}
        duration={2000}
        position="bottom"
        color="success"
      />

      <IonToast
        isOpen={errorToast !== null}
        onDidDismiss={() => setErrorToast(null)}
        message={errorToast ?? ''}
        duration={3500}
        position="bottom"
        color="danger"
      />
    </>
  );
}
