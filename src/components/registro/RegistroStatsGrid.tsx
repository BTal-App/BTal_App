import { useState } from 'react';
import { IonAlert } from '@ionic/react';
import { MealIcon } from '../MealIcon';

// 4 stat cards de la tab Registro · réplica del grid del v2 mockup
// (`stats-grid` con `.stat-card` icono + label + val + sub).
//
// Cada card es clickable y abre un IonAlert con la descripción de qué
// mide la métrica · el icono ⓘ en la esquina visualiza la affordance.
//
// ⚠ NOTA SOBRE LA ANIMACIÓN DE ENTRADA
// Las clases `btal-anim-fade-up` + `btal-stagger-N` son keyframe
// animations one-shot · React respeta los DOM nodes entre renders y
// las animaciones NO se re-disparan a menos que el componente se
// re-monte. Por eso los 4 cards están escritos INLINE (no como un
// helper `<StatCard>` definido dentro del padre): si la helper
// function se redefine cada render, React la trata como un componente
// distinto en cada render, desmonta y vuelve a montar el DOM, y la
// animación se vuelve a disparar al abrir/cerrar el IonAlert (cambio
// de state interno del padre). Mantener los buttons inline garantiza
// que las cards solo animen al entrar en la tab por primera vez.

export interface RegistroStatsGridProps {
  rachaActual: number;
  rachaUltimaFecha: string | null;
  esteMesEntrenados: number;
  esteMesTotalDias: number;
  prsTotal: number;
  totalEntrenos: number;
}

type StatKey = 'racha' | 'esteMes' | 'prs' | 'total';

const STAT_INFO: Record<StatKey, { title: string; message: string }> = {
  racha: {
    title: 'Racha actual',
    message:
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
      + 'Mira tu historial completo y mejores rachas en «Gráficos» → pestaña «Rachas».',
  },
  esteMes: {
    title: 'Este mes',
    message:
      'Días con entrenamiento real (excluyendo descansos) registrados en el mes que estás viendo en el calendar. El segundo número es la referencia: días transcurridos del mes hasta hoy si miras el mes actual, o el total de días si miras un mes pasado.',
  },
  prs: {
    title: "PR's (Personal Records)",
    message:
      "Número de ejercicios distintos en los que has alcanzado tu peso máximo histórico. Cada vez que superas tu récord en un ejercicio (kg más alto que cualquier sesión anterior) sube. Solo se actualiza al alza al guardar · eliminar un registro NO descuenta PR's.",
  },
  total: {
    title: 'Total registrado',
    message:
      'Total de días con registro guardado desde que empezaste a usar la app · suma entrenos y descansos. Cada save de un día nuevo lo aumenta en 1, cada delete lo reduce en 1.',
  },
};

export function RegistroStatsGrid({
  rachaActual,
  rachaUltimaFecha,
  esteMesEntrenados,
  esteMesTotalDias,
  prsTotal,
  totalEntrenos,
}: RegistroStatsGridProps) {
  const [infoKey, setInfoKey] = useState<StatKey | null>(null);

  // Sub-text de la racha · si la última fecha contada es ayer (no
  // hoy) lo indicamos para que el user sepa por qué la racha no es 0
  // pese a no haber registrado nada hoy.
  const rachaSub = (() => {
    if (rachaActual === 0) return 'sin racha · ¡empieza hoy!';
    if (!rachaUltimaFecha) return 'días consecutivos';
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (rachaUltimaFecha === todayKey) {
      return rachaActual === 1 ? 'día consecutivo' : 'días consecutivos';
    }
    return 'hasta ayer · regístra hoy para sumar';
  })();

  const esteMesSub = `de ${esteMesTotalDias} días ${
    esteMesEntrenados === 1 ? 'entrenado' : 'entrenados'
  }`;
  const prsSub = prsTotal === 1
    ? "ejercicio con récord"
    : "ejercicios con récord";
  const totalSub = totalEntrenos === 1
    ? 'día registrado'
    : 'días registrados';

  return (
    <>
      <div className="reg-stats-grid">
        {/* 🔥 Racha actual */}
        <button
          type="button"
          className="reg-stat-card btal-anim-fade-up btal-stagger-1"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            setInfoKey('racha');
          }}
          aria-label={`Racha actual · ${rachaActual} · pulsa para ver qué mide`}
        >
          <div className="reg-stat-info-icon" aria-hidden>
            <MealIcon value="tb:info-circle" size={14} />
          </div>
          <div className="reg-stat-lbl">
            <MealIcon value="tb:flame" size={16} className="reg-stat-lbl-icon" />
            Racha actual
          </div>
          <div className="reg-stat-val">{rachaActual}</div>
          <div className="reg-stat-sub">{rachaSub}</div>
        </button>

        {/* Este mes */}
        <button
          type="button"
          className="reg-stat-card btal-anim-fade-up btal-stagger-2"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            setInfoKey('esteMes');
          }}
          aria-label={`Este mes · ${esteMesEntrenados} · pulsa para ver qué mide`}
        >
          <div className="reg-stat-info-icon" aria-hidden>
            <MealIcon value="tb:info-circle" size={14} />
          </div>
          <div className="reg-stat-lbl">
            <MealIcon value="tb:barbell" size={16} className="reg-stat-lbl-icon" />
            Este mes
          </div>
          <div className="reg-stat-val">{esteMesEntrenados}</div>
          <div className="reg-stat-sub">{esteMesSub}</div>
        </button>

        {/* PR's */}
        <button
          type="button"
          className="reg-stat-card btal-anim-fade-up btal-stagger-3"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            setInfoKey('prs');
          }}
          aria-label={`PR's · ${prsTotal} · pulsa para ver qué mide`}
        >
          <div className="reg-stat-info-icon" aria-hidden>
            <MealIcon value="tb:info-circle" size={14} />
          </div>
          <div className="reg-stat-lbl">
            <MealIcon value="tb:trophy" size={16} className="reg-stat-lbl-icon" />
            PR&apos;s
          </div>
          <div className="reg-stat-val">{prsTotal}</div>
          <div className="reg-stat-sub">{prsSub}</div>
        </button>

        {/* Total */}
        <button
          type="button"
          className="reg-stat-card btal-anim-fade-up btal-stagger-4"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            setInfoKey('total');
          }}
          aria-label={`Total · ${totalEntrenos} · pulsa para ver qué mide`}
        >
          <div className="reg-stat-info-icon" aria-hidden>
            <MealIcon value="tb:info-circle" size={14} />
          </div>
          <div className="reg-stat-lbl">
            <MealIcon value="tb:bolt" size={16} className="reg-stat-lbl-icon" />
            Total
          </div>
          <div className="reg-stat-val">{totalEntrenos}</div>
          <div className="reg-stat-sub">{totalSub}</div>
        </button>
      </div>

      <IonAlert
        isOpen={infoKey !== null}
        header={infoKey ? STAT_INFO[infoKey].title : ''}
        message={infoKey ? STAT_INFO[infoKey].message : ''}
        cssClass="alert-multiline"
        buttons={['Entendido']}
        onDidDismiss={() => setInfoKey(null)}
      />
    </>
  );
}
