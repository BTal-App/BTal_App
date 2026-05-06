import { useState } from 'react';
import { IonButton, IonIcon, IonModal, IonToast } from '@ionic/react';
import { checkmarkCircle, closeOutline } from 'ionicons/icons';
import { usePreferences } from '../hooks/usePreferences';
import {
  formatHeight,
  formatWeight,
  type UnitsSystem,
  type WeekStart,
} from '../utils/units';
import './SettingsModal.css';
import './PreferencesModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesModal({ isOpen, onClose }: Props) {
  const {
    units: savedUnits,
    weekStart: savedWeekStart,
    setPreferences,
  } = usePreferences();

  // Form state · cambios solo se aplican al pulsar Guardar.
  const [units, setUnits] = useState<UnitsSystem>(savedUnits);
  const [weekStart, setWeekStart] = useState<WeekStart>(savedWeekStart);
  const [savedToast, setSavedToast] = useState(false);

  // Reset al abrir el modal: copia los valores actuales al form.
  const resetForm = () => {
    setUnits(savedUnits);
    setWeekStart(savedWeekStart);
    setSavedToast(false);
  };

  // ¿Hay cambios pendientes respecto a lo guardado?
  const dirty = units !== savedUnits || weekStart !== savedWeekStart;

  const handleSave = () => {
    if (!dirty) return;
    setPreferences({ units, weekStart });
    setSavedToast(true);
  };

  // Pequeñas previews para que el cambio se vea en vivo (con form state).
  const samplePeso = 75; // kg
  const sampleAltura = 178; // cm

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetForm}
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
            <h2 className="settings-modal-title">Preferencias</h2>
            <p className="settings-modal-text">
              Ajusta cómo te mostramos los datos en la app.
            </p>

            {/* ── Sistema de unidades ─────────────────────── */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">Sistema de unidades</span>
                <span className="prefs-row-sub">
                  Peso y altura en {units === 'metric' ? 'kg / cm' : 'lb / in'}.
                  Ej: {formatWeight(samplePeso, units)} ·{' '}
                  {formatHeight(sampleAltura, units)}
                </span>
              </div>
              <div className="prefs-segment">
                <button
                  type="button"
                  className={units === 'metric' ? 'active' : ''}
                  onClick={() => setUnits('metric')}
                >
                  Métrico
                </button>
                <button
                  type="button"
                  className={units === 'imperial' ? 'active' : ''}
                  onClick={() => setUnits('imperial')}
                >
                  Imperial
                </button>
              </div>
            </div>

            {/* ── Inicio de la semana ─────────────────────── */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">Inicio de la semana</span>
                <span className="prefs-row-sub">
                  Día con el que arranca el calendario semanal.
                </span>
              </div>
              <div className="prefs-segment">
                <button
                  type="button"
                  className={weekStart === 'monday' ? 'active' : ''}
                  onClick={() => setWeekStart('monday')}
                >
                  Lunes
                </button>
                <button
                  type="button"
                  className={weekStart === 'sunday' ? 'active' : ''}
                  onClick={() => setWeekStart('sunday')}
                >
                  Domingo
                </button>
              </div>
            </div>

            <p
              className="settings-modal-text"
              style={{ color: 'var(--btal-t-3)', fontSize: '0.78rem' }}
            >
              Para usuarios con cuenta, las preferencias también se guardan en
              Firestore y se sincronizan entre dispositivos.
            </p>

            <IonButton
              type="button"
              expand="block"
              className="settings-modal-primary"
              onClick={handleSave}
              disabled={!dirty}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              Guardar
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* Aviso flotante "Preferencias guardadas" — vive fuera del modal
          para que se vea aunque el usuario no cierre el modal y la
          posición sea consistente con el resto de toasts de la app. */}
      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Preferencias guardadas"
        duration={2000}
        position="bottom"
        color="success"
      />
    </>
  );
}
