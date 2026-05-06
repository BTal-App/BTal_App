import { IonIcon, IonModal } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { usePreferences } from '../hooks/usePreferences';
import { formatHeight, formatWeight } from '../utils/units';
import './SettingsModal.css';
import './PreferencesModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesModal({ isOpen, onClose }: Props) {
  const { units, weekStart, setUnits, setWeekStart } = usePreferences();

  // Pequeñas previews para que el cambio se vea en vivo.
  const samplePeso = 75; // kg
  const sampleAltura = 178; // cm

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
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
                Ej: {formatWeight(samplePeso, units)} · {formatHeight(sampleAltura, units)}
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

          <p className="settings-modal-text" style={{ color: 'var(--btal-t-3)', fontSize: '0.78rem' }}>
            Las preferencias se guardan en este dispositivo. Cuando integremos
            sincronización entre dispositivos viajarán contigo automáticamente.
          </p>
        </div>
      </div>
    </IonModal>
  );
}
