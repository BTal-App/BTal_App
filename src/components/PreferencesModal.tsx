import { useEffect, useRef, useState } from 'react';
import { IonButton, IonModal, IonToast } from '@ionic/react';
import { MealIcon } from './MealIcon';
import { usePreferences } from '../hooks/usePreferences';
import {
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import {
  formatHeight,
  formatWeight,
  type NavStyle,
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
    navStyle: savedNavStyle,
    setPreferences,
  } = usePreferences();

  // Form state · cambios solo se aplican al pulsar Guardar.
  const [units, setUnits] = useState<UnitsSystem>(savedUnits);
  const [weekStart, setWeekStart] = useState<WeekStart>(savedWeekStart);
  const [navStyle, setNavStyle] = useState<NavStyle>(savedNavStyle ?? 'labeled');
  const [savedToast, setSavedToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  // Status del guardado · usado solo para deshabilitar el botón mientras
  // saving (no se muestra SaveIndicator inline aquí · el toast verde
  // "Preferencias guardadas" es el único feedback visual de éxito).
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  // Track de montaje · evita setState tras unmount cuando el modal se
  // cierra justo después del save (ya no necesitamos el timer del
  // toast pre-éxito pero mantenemos esta protección por consistencia).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Reset al abrir el modal: copia los valores actuales al form.
  const resetForm = () => {
    setUnits(savedUnits);
    setWeekStart(savedWeekStart);
    setNavStyle(savedNavStyle ?? 'labeled');
    setSavedToast(false);
    setErrorToast(null);
    resetSave();
  };

  // ¿Hay cambios pendientes respecto a lo guardado?
  const dirty =
    units !== savedUnits
    || weekStart !== savedWeekStart
    || navStyle !== (savedNavStyle ?? 'labeled');

  const handleSave = async () => {
    if (!dirty || submitting) return;
    // Al guardar limpiamos también el override de URL (sessionStorage)
    // · si el user había probado `?nav=...` antes, la elección persistente
    // ahora gana inmediatamente.
    try {
      sessionStorage.removeItem('btal-nav-preview');
    } catch {
      /* private mode · best effort */
    }
    const result = await runSave(() =>
      setPreferences({ units, weekStart, navStyle }),
    );
    if (!mounted.current) return;
    if (result === SAVE_FAILED) {
      setErrorToast('No hemos podido guardar. Inténtalo de nuevo.');
      return;
    }
    // Éxito · mostramos el toast verde Y cerramos el modal al instante.
    // El toast vive fuera del modal en el JSX y persiste 2s tras el
    // cierre · el user ve el "Preferencias guardadas" sobre Ajustes y
    // ya no espera 2s con el modal abierto encima.
    setSavedToast(true);
    onClose();
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

            {/* ── Estilo del nav inferior ─────────────────────
                 'labeled' · icono grande + nombre del menú debajo ·
                 más explícito, mejor para usuarios nuevos.
                 'compact' · solo icono · más compacto, ahorra
                 espacio vertical. */}
            <div className="prefs-row">
              <div className="prefs-row-info">
                <span className="prefs-row-label">Estilo del menú inferior</span>
                <span className="prefs-row-sub">
                  {navStyle === 'labeled'
                    ? 'Icono grande con el nombre del menú debajo.'
                    : 'Solo el icono, sin el nombre del menú.'}
                </span>
              </div>
              <div className="prefs-segment">
                <button
                  type="button"
                  className={navStyle === 'labeled' ? 'active' : ''}
                  onClick={() => setNavStyle('labeled')}
                >
                  Iconos + Textos
                </button>
                <button
                  type="button"
                  className={navStyle === 'compact' ? 'active' : ''}
                  onClick={() => setNavStyle('compact')}
                >
                  Sólo iconos
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
              disabled={!dirty || submitting}
            >
              <MealIcon value="tb:circle-check-filled" size={18} slot="start" />
              {submitting ? 'Guardando…' : 'Guardar'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* Aviso flotante "Preferencias guardadas" · único feedback visual
          de éxito. El modal ya se cerró en `handleSave` justo al activar
          el toast · este vive fuera del modal en el JSX y persiste sus
          2s por encima de Ajustes. */}
      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Preferencias guardadas"
        duration={2000}
        position="bottom"
        color="success"
      />

      {/* Toast de error · solo aparece si la escritura falla. Rojo
          para que el user note el problema y pueda reintentar.
          NO cierra el modal · el user puede volver a pulsar Guardar
          tras revisar conexión / autenticación. */}
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
