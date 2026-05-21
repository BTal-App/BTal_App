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
  + 'registrado.\n\n'
  + 'Cuándo se rompe:\n'
  + '• Si registras un día como DESCANSO\n'
  + '• Si no registras actividad durante un día completo\n\n'
  + 'Más detalles:\n'
  + '• Margen de hoy: si hoy aún no has registrado actividad pero ayer sí entrenaste, la racha mantiene el valor de ayer hasta que termine el día. Te da margen para entrenar más tarde.\n'
  + '• Para empezar la racha, registra un entrenamiento y verás «1 día». Cada entrenamiento consecutivo posterior suma +1.\n'
  + '• Puedes ver tu historial completo y mejores rachas en «Gráficos» → pestaña «Rachas».';

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
            ? 'Sin racha · Pulsa para ver cómo empezar tu racha de entrenos'
            : `Racha: ${dias} ${dias === 1 ? 'día' : 'días'} entrenando · Pulsa para ver cómo funciona`
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
