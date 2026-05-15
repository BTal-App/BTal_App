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
// Se muestra SIEMPRE en HoyPage, incluso con racha = 0 (decisión de
// producto · sirve de recordatorio constante y CTA implícito a
// entrenar). Cuando está a 0 aplica la clase `streak-badge--zero`
// (atenuado · no parece un error sino un "empieza tu racha").
export function StreakBadge() {
  const { racha } = useRegistroStats();
  const [infoOpen, setInfoOpen] = useState(false);
  const dias = racha?.actual ?? 0;
  const isZero = dias === 0;

  return (
    <>
      <button
        type="button"
        className={'streak-badge' + (isZero ? ' streak-badge--zero' : '')}
        onClick={(e) => {
          e.currentTarget.blur();
          setInfoOpen(true);
        }}
        aria-label={
          isZero
            ? 'Sin racha · pulsa para ver cómo empezar tu racha de entrenos'
            : `Racha: ${dias} ${dias === 1 ? 'día' : 'días'} entrenando · pulsa para ver cómo funciona`
        }
      >
        <MealIcon value="tb:bolt" size={16} />
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
