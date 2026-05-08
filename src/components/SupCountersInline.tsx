import { useEffect, useRef, useState } from 'react';
import { IonAlert, IonIcon, IonToast } from '@ionic/react';
import {
  addOutline,
  helpCircleOutline,
  refreshOutline,
  removeOutline,
} from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  calcBatidoStats,
  calcCreatinaStats,
  type Suplementos,
} from '../templates/defaultUser';
import { computeSupAlerts } from '../utils/supAlerts';
import { SupAlertBox } from './SupAlertBox';
import './SupModal.css';

interface Props {
  kind: 'batido' | 'creatina';
}

// Tipo del reset · 'semanal' | 'mensual' | 'anual' son periódicos y
// admiten "Deshacer" tras la acción. 'total' es global e irreversible.
type ResetKind = 'semanal' | 'mensual' | 'anual' | 'total';

// Bloque inline (NO modal) con contador ±1, métricas y resets. Vive
// dentro de BatidoInfoModal / CreatinaInfoModal · réplica del v1
// modal-batido-info / modal-creatina-info ampliada con contador anual.
// Datos sincronizados con HoyPage y CompraPage (mismo provider).
export function SupCountersInline({ kind }: Props) {
  const {
    profile: userDoc,
    incrementarBatidoTomado,
    decrementarBatidoTomado,
    incrementarCreatinaTomada,
    decrementarCreatinaTomada,
    resetBatidoSemanal,
    resetBatidoMensual,
    resetBatidoAnual,
    resetBatidoTotal,
    resetCreatinaSemanal,
    resetCreatinaMensual,
    resetCreatinaAnual,
    resetCreatinaTotal,
    restoreSupValues,
  } = useProfile();
  const sup = userDoc?.suplementos;

  // Toast de éxito · pop-up que entra/sale automático.
  const [successToast, setSuccessToast] = useState(false);
  // Confirmación previa al reset · contiene el tipo y el mensaje.
  const [confirmReset, setConfirmReset] = useState<{
    kind: ResetKind;
    header: string;
    message: string;
  } | null>(null);
  // Pop-up info "Total este año" · al pulsar el icono ⓘ desde móvil
  // (también usable en desktop). Sustituye al title attribute que en
  // móvil no es accesible (no hay hover).
  const [yearInfoOpen, setYearInfoOpen] = useState(false);
  // Snapshot para "Deshacer" · capturado justo antes de un reset
  // periódico (semanal/mensual/anual). null = no hay nada que deshacer.
  const [undoSnapshot, setUndoSnapshot] = useState<{
    kind: ResetKind;
    patch: Partial<Suplementos>;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  if (!sup) return null;

  const stats =
    kind === 'batido' ? calcBatidoStats(sup) : calcCreatinaStats(sup);
  const tomados =
    kind === 'batido'
      ? sup.batidos_tomados_total
      : sup.creatinas_tomadas_total;
  // Botón + deshabilitado si ya estás al máximo del stock.
  const plusDisabled =
    stats.posibles !== null && tomados >= stats.posibles;
  const tomadosSemana =
    kind === 'batido'
      ? sup.batidos_tomados_semana
      : sup.creatinas_tomadas_semana;
  const tomadosMes =
    kind === 'batido'
      ? sup.batidos_tomados_mes
      : sup.creatinas_tomadas_mes;
  const tomadosAnio =
    kind === 'batido'
      ? sup.batidos_tomados_anio
      : sup.creatinas_tomadas_anio;

  const handleMinus = () => {
    if (kind === 'batido') {
      decrementarBatidoTomado().catch((err) =>
        console.error('[BTal] decrementarBatido error:', err),
      );
    } else {
      decrementarCreatinaTomada().catch((err) =>
        console.error('[BTal] decrementarCreatina error:', err),
      );
    }
  };

  const handlePlus = () => {
    if (kind === 'batido') {
      incrementarBatidoTomado().catch((err) =>
        console.error('[BTal] incrementarBatido error:', err),
      );
    } else {
      incrementarCreatinaTomada().catch((err) =>
        console.error('[BTal] incrementarCreatina error:', err),
      );
    }
  };

  // Captura el snapshot de los campos que va a resetear cada acción.
  // Usado para que el toast "Deshacer" pueda restaurarlos exactamente.
  const captureSnapshot = (type: ResetKind): Partial<Suplementos> => {
    if (kind === 'batido') {
      if (type === 'semanal') {
        return {
          batidos_tomados_semana: sup.batidos_tomados_semana,
          batido_semana_inicio: sup.batido_semana_inicio,
        };
      }
      if (type === 'mensual') {
        return {
          batidos_tomados_mes: sup.batidos_tomados_mes,
          batido_mes_inicio: sup.batido_mes_inicio,
        };
      }
      if (type === 'anual') {
        return {
          batidos_tomados_anio: sup.batidos_tomados_anio,
          batido_anio_inicio: sup.batido_anio_inicio,
        };
      }
      // total · capturamos los 4 contadores + marcas (no se usa aún
      // para deshacer, pero por simetría).
      return {
        batidos_tomados_total: sup.batidos_tomados_total,
        batidos_tomados_semana: sup.batidos_tomados_semana,
        batidos_tomados_mes: sup.batidos_tomados_mes,
        batidos_tomados_anio: sup.batidos_tomados_anio,
        batido_semana_inicio: sup.batido_semana_inicio,
        batido_mes_inicio: sup.batido_mes_inicio,
        batido_anio_inicio: sup.batido_anio_inicio,
      };
    }
    // creatina
    if (type === 'semanal') {
      return {
        creatinas_tomadas_semana: sup.creatinas_tomadas_semana,
        creatina_semana_inicio: sup.creatina_semana_inicio,
      };
    }
    if (type === 'mensual') {
      return {
        creatinas_tomadas_mes: sup.creatinas_tomadas_mes,
        creatina_mes_inicio: sup.creatina_mes_inicio,
      };
    }
    if (type === 'anual') {
      return {
        creatinas_tomadas_anio: sup.creatinas_tomadas_anio,
        creatina_anio_inicio: sup.creatina_anio_inicio,
      };
    }
    return {
      creatinas_tomadas_total: sup.creatinas_tomadas_total,
      creatinas_tomadas_semana: sup.creatinas_tomadas_semana,
      creatinas_tomadas_mes: sup.creatinas_tomadas_mes,
      creatinas_tomadas_anio: sup.creatinas_tomadas_anio,
      creatina_semana_inicio: sup.creatina_semana_inicio,
      creatina_mes_inicio: sup.creatina_mes_inicio,
      creatina_anio_inicio: sup.creatina_anio_inicio,
    };
  };

  const doReset = async (type: ResetKind) => {
    // Capturamos snapshot ANTES del reset · solo para periódicos
    // (semanal/mensual/anual) · el "total" es irreversible · no
    // ofrecemos undo.
    const snapshot = captureSnapshot(type);
    try {
      if (kind === 'batido') {
        if (type === 'semanal') await resetBatidoSemanal();
        else if (type === 'mensual') await resetBatidoMensual();
        else if (type === 'anual') await resetBatidoAnual();
        else await resetBatidoTotal();
      } else {
        if (type === 'semanal') await resetCreatinaSemanal();
        else if (type === 'mensual') await resetCreatinaMensual();
        else if (type === 'anual') await resetCreatinaAnual();
        else await resetCreatinaTotal();
      }
      // Pop-up de éxito · entra/sale solo en 2s.
      setSuccessToast(true);
      // Si es periódico, programamos el undo 5s.
      if (type !== 'total') {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndoSnapshot({ kind: type, patch: snapshot });
        undoTimer.current = setTimeout(() => {
          setUndoSnapshot(null);
        }, 5000);
      }
    } catch (err) {
      console.error('[BTal] reset sup error:', err);
    }
  };

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const patch = undoSnapshot.patch;
    setUndoSnapshot(null);
    try {
      await restoreSupValues(patch);
    } catch (err) {
      console.error('[BTal] undo reset error:', err);
    }
  };

  const productoLabel = kind === 'batido' ? 'batido' : 'creatina';

  // Helpers para abrir la confirmación con el texto correcto. Cada stat
  // periódica tiene su propio botón ⟳ a la derecha que dispara esto.
  const askResetSemanal = () =>
    setConfirmReset({
      kind: 'semanal',
      header: '¿Reiniciar contador semanal?',
      message:
        'Vamos a poner a 0 el contador de "Total esta semana". '
        + 'Tendrás 5 segundos para deshacer la acción.',
    });
  const askResetMensual = () =>
    setConfirmReset({
      kind: 'mensual',
      header: '¿Reiniciar contador mensual?',
      message:
        'Vamos a poner a 0 el contador de "Total este mes". '
        + 'Tendrás 5 segundos para deshacer la acción.',
    });
  const askResetAnual = () =>
    setConfirmReset({
      kind: 'anual',
      header: '¿Reiniciar contador anual?',
      message:
        'Vamos a poner a 0 el contador de "Total este año". '
        + 'Tendrás 5 segundos para deshacer la acción.',
    });
  const askResetTotal = () =>
    setConfirmReset({
      kind: 'total',
      header: '¿Reiniciar todos los contadores?',
      message:
        `Esta acción es IRREVERSIBLE. Va a poner a 0 los 4 `
        + `contadores de ${productoLabel}: total, total esta `
        + `semana, total este mes y total este año. `
        + `No se podrá deshacer.`,
    });

  return (
    <>
      {/* Separador visual entre la sección anterior (macros / dosis) y
          el bloque de contadores · igual que el divider del v1. */}
      <div className="sup-divider" aria-hidden="true" />

      {/* Counter ±1 · igual layout que v1 modal-batido-info / modal-
          creatina-info. */}
      <div className="sup-section-label">
        Contador {kind === 'batido' ? 'de batidos' : 'de dosis'}
      </div>
      <div className="sup-counter-row">
        <button
          type="button"
          className="sup-counter-btn"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            handleMinus();
          }}
          disabled={tomados === 0}
          aria-label={
            kind === 'batido' ? 'Restar batido' : 'Restar dosis'
          }
        >
          <IonIcon icon={removeOutline} />
        </button>
        <div className="sup-counter-num">
          {/* `key={tomados}` re-monta el span en cada cambio de valor,
              re-disparando la animación btal-bump · feedback inmediato
              al pulsar +/− igual que el v1 modal-batido-info. */}
          <span
            key={tomados}
            className="sup-counter-value btal-anim-bump"
          >
            {tomados}
          </span>
          <span className="sup-counter-label">
            {kind === 'batido' ? 'tomados' : 'tomadas'}
          </span>
        </div>
        <button
          type="button"
          className="sup-counter-btn sup-counter-btn--add"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            handlePlus();
          }}
          disabled={plusDisabled}
          aria-label={kind === 'batido' ? 'Sumar batido' : 'Sumar dosis'}
          title={
            plusDisabled
              ? `Sin stock disponible · compra más ${
                  kind === 'batido' ? 'proteína/creatina' : 'creatina'
                }`
              : undefined
          }
        >
          <IonIcon icon={addOutline} />
        </button>
      </div>

      {/* Métricas · 5 stats. La 1ª (totales según gramos) ocupa el
          ancho completo del grid · las 4 restantes se reparten en
          2x2 (móvil) / 4x1 (desktop). Las stats periódicas (semana,
          mes, año) llevan un mini-botón ⟳ a la derecha para resetear
          ese contador concreto, y el año añade ⓘ a la izquierda con
          el detalle de qué significa "año natural". */}
      <div className="sup-stats-grid">
        <div className="sup-stat sup-stat--full">
          <span className="sup-stat-label">
            {kind === 'batido'
              ? 'Batidos totales según gr indicados'
              : 'Total dosis según gr indicados'}
          </span>
          <span
            key={`pos-${stats.posibles ?? 'na'}`}
            className="sup-stat-num sup-stat-num--posibles btal-anim-bump"
          >
            {stats.posibles ?? '—'}
          </span>
        </div>
        <div className="sup-stat">
          <span className="sup-stat-label">
            {kind === 'batido' ? 'Batidos restantes' : 'Dosis restantes'}
          </span>
          <span
            key={`rest-${stats.restantes ?? 'na'}`}
            className={
              'sup-stat-num sup-stat-num--restantes btal-anim-bump'
              + (stats.restantes !== null && stats.restantes === 0
                ? ' sup-stat-num--danger'
                : stats.restantes !== null && stats.restantes < 7
                ? ' sup-stat-num--warn'
                : '')
            }
          >
            {stats.restantes ?? '—'}
          </span>
        </div>
        <div className="sup-stat">
          <span className="sup-stat-label">Total esta semana</span>
          <span
            key={`sem-${tomadosSemana}`}
            className="sup-stat-num btal-anim-bump"
          >
            {tomadosSemana}
          </span>
          <button
            type="button"
            className="sup-stat-reset"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              askResetSemanal();
            }}
            aria-label="Reiniciar contador semanal"
            title="Reiniciar contador semanal"
          >
            <IonIcon icon={refreshOutline} />
          </button>
        </div>
        <div className="sup-stat">
          <span className="sup-stat-label">Total este mes</span>
          <span
            key={`mes-${tomadosMes}`}
            className="sup-stat-num btal-anim-bump"
          >
            {tomadosMes}
          </span>
          <button
            type="button"
            className="sup-stat-reset"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              askResetMensual();
            }}
            aria-label="Reiniciar contador mensual"
            title="Reiniciar contador mensual"
          >
            <IonIcon icon={refreshOutline} />
          </button>
        </div>
        <div className="sup-stat">
          <button
            type="button"
            className="sup-stat-info"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              setYearInfoOpen(true);
            }}
            aria-label="Información sobre Total este año"
            title="¿Qué significa Total este año?"
          >
            <IonIcon icon={helpCircleOutline} />
          </button>
          <span className="sup-stat-label">Total este año</span>
          <span
            key={`anio-${tomadosAnio}`}
            className="sup-stat-num btal-anim-bump"
          >
            {tomadosAnio}
          </span>
          <button
            type="button"
            className="sup-stat-reset"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              askResetAnual();
            }}
            aria-label="Reiniciar contador anual"
            title="Reiniciar contador anual"
          >
            <IonIcon icon={refreshOutline} />
          </button>
        </div>
      </div>

      {/* Avisos de stock · réplica v1 supl-alert (orange/red). */}
      {(() => {
        const alerts = computeSupAlerts(sup);
        if (kind === 'batido') {
          return (
            <>
              {alerts.batidoProt && <SupAlertBox alert={alerts.batidoProt} />}
              {alerts.batidoCreat && (
                <SupAlertBox alert={alerts.batidoCreat} />
              )}
            </>
          );
        }
        return alerts.creatina && <SupAlertBox alert={alerts.creatina} />;
      })()}

      {/* Botón "Reiniciar todos los contadores" · ocupa el ancho
          completo, va inmediatamente debajo de las stats sin
          encabezado de sección (los resets parciales ya viven en
          cada stat). Marcado como destructivo · IRREVERSIBLE. */}
      <button
        type="button"
        className="sup-reset-btn sup-reset-btn--danger sup-reset-btn--block"
        onClick={(e) => {
          (e.currentTarget as HTMLElement).blur();
          askResetTotal();
        }}
      >
        <IonIcon icon={refreshOutline} />
        Reiniciar todos los contadores
      </button>

      {/* IonAlert · confirmación previa al reset. */}
      <IonAlert
        isOpen={confirmReset !== null}
        onDidDismiss={() => setConfirmReset(null)}
        header={confirmReset?.header ?? ''}
        message={confirmReset?.message ?? ''}
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Reiniciar',
            role: 'destructive',
            handler: () => {
              if (!confirmReset) return;
              doReset(confirmReset.kind).catch((err) => {
                console.error('[BTal] doReset unhandled:', err);
              });
            },
          },
        ]}
      />

      {/* Pop-up info "Total este año" · accesible en móvil (tap)
          ya que :hover/title no funciona sin puntero. */}
      <IonAlert
        isOpen={yearInfoOpen}
        onDidDismiss={() => setYearInfoOpen(false)}
        header="Total este año"
        message={
          'Año natural: cuenta del 1 de enero al 31 de diciembre del '
          + 'año en curso. Se reinicia automáticamente cada 1 de enero.'
        }
        buttons={[{ text: 'Cerrar', role: 'cancel' }]}
      />

      {/* Pop-up "Contador reseteado" · entra y sale en 2s. */}
      <IonToast
        isOpen={successToast}
        onDidDismiss={() => setSuccessToast(false)}
        message="Contador reiniciado"
        duration={2000}
        position="bottom"
        color="success"
      />

      {/* Toast con "Deshacer" 5s · solo para resets periódicos. */}
      <IonToast
        isOpen={undoSnapshot !== null}
        onDidDismiss={() => setUndoSnapshot(null)}
        message={
          undoSnapshot
            ? `Contador ${undoSnapshot.kind} reiniciado`
            : ''
        }
        duration={5000}
        position="bottom"
        color="medium"
        buttons={[
          {
            text: 'Deshacer',
            role: 'cancel',
            handler: () => {
              handleUndo().catch((err) => {
                console.error('[BTal] handleUndo unhandled:', err);
              });
            },
          },
        ]}
      />
    </>
  );
}
