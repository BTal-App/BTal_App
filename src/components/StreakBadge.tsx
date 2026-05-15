import { useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useRegistroStats } from '../hooks/useRegistroStats';
import { MealIcon } from './MealIcon';
import './StreakBadge.css';

// Mismo texto que el tooltip del stat "Racha actual" del Registro ·
// fuente única de verdad de la regla para que el user lea lo mismo
// pulse donde pulse. Si se cambia aquí, cambiar también en
// RegistroStatsGrid.tsx (STAT_INFO.racha.message).
const RACHA_INFO =
  'Días consecutivos entrenando. Solo cuentan los días con entrenamiento '
  + 'registrado · los descansos NO suman y rompen la racha.\n\n'
  + 'Cuándo se rompe:\n'
  + '• Si registras un día como DESCANSO · rompe al instante (incluso hoy)\n'
  + '• Si pasa un día completo sin registrar nada · rompe al día siguiente\n\n'
  + 'Excepción (margen de hoy): si HOY aún no has registrado nada pero ayer '
  + 'sí entrenaste, la racha sigue mostrando el valor de ayer hasta que pase '
  + 'el día · te da margen para entrenar más tarde.\n\n'
  + 'Para empezar racha: registra un entrenamiento y verás «1 día». Cada '
  + 'entrenamiento consecutivo posterior suma +1.\n\n'
  + 'Mira tu historial completo y mejores rachas en «Gráficos» → pestaña «Rachas».';

// Chip "🔥 N días" que se muestra a la izquierda del avatar en el
// TabHeader de HoyPage. Lee la racha de entrenos consecutivos del
// mismo hook que alimenta el stat "RACHA actual" del Registro · regla
// única: solo entrenos cuentan, descansos y vacíos rompen (ver
// `useRegistroStats.calcRacha`).
//
// Es un botón · al pulsarlo abre un IonAlert explicando exactamente
// qué cuenta y qué rompe la racha (mismo texto que el ⓘ del stat del
// Registro · una sola fuente de verdad).
//
// No se renderiza si racha = 0 · evita ruido visual cuando el user
// nunca ha entrenado o cuando su racha se acaba de romper. El header
// queda limpio (solo avatar) hasta que hay racha que presumir.
export function StreakBadge() {
  const { racha } = useRegistroStats();
  const [infoOpen, setInfoOpen] = useState(false);
  const dias = racha?.actual ?? 0;

  if (dias === 0) return null;

  return (
    <>
      <button
        type="button"
        className="streak-badge"
        onClick={(e) => {
          e.currentTarget.blur();
          setInfoOpen(true);
        }}
        aria-label={`Racha: ${dias} ${dias === 1 ? 'día' : 'días'} entrenando · pulsa para ver cómo funciona`}
      >
        <MealIcon value="tb:flame" size={14} />
        <span className="streak-badge-num">{dias}</span>
        <span className="streak-badge-label">{dias === 1 ? 'día' : 'días'}</span>
      </button>

      <IonAlert
        isOpen={infoOpen}
        header="Racha actual"
        message={RACHA_INFO}
        cssClass="alert-multiline"
        buttons={['Entendido']}
        onDidDismiss={() => setInfoOpen(false)}
      />
    </>
  );
}
