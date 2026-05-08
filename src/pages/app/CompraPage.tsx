import { useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import {
  cartOutline,
  flaskOutline,
  pencilOutline,
} from 'ionicons/icons';
import { TabHeader } from '../../components/TabHeader';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { EditSupStockModal } from '../../components/EditSupStockModal';
import { SupAlertBox } from '../../components/SupAlertBox';
import { useProfile } from '../../hooks/useProfile';
import {
  calcBatidoStats,
  calcCreatinaStats,
} from '../../templates/defaultUser';
import { computeSupAlerts, type SupAlert } from '../../utils/supAlerts';
import { blurAndRun } from '../../utils/focus';
import './CompraPage.css';

// Tab Compra · Sub-fase 2B.5.b · solo el bloque de suplementación está
// implementado (igual que el v1: card "💪 SUPLEMENTACIÓN" con productos
// Proteína y Creatina, tracker en gramos consumidos/restantes, badge
// "X batidos posibles" y coste mensual/anual). El resto de la lista
// (frutas/proteínas/lácteos/etc.) llega en Fase 2C cuando se derive
// automáticamente del menú semanal.
const CompraPage: React.FC = () => {
  const { profile: userDoc } = useProfile();
  const sup = userDoc?.suplementos;

  const [editing, setEditing] = useState<'batido' | 'creatina' | null>(null);

  const batidoStats = sup ? calcBatidoStats(sup) : null;
  const creatinaStats = sup ? calcCreatinaStats(sup) : null;
  // Avisos de stock · réplica v1. Para la fila de PROTEÍNA usamos
  // alerts.batidoProt (cuántos batidos quedan según proteína). Para la
  // fila de CREATINA usamos alerts.creatina (descuenta lo que ya consumen
  // los batidos · si includeCreatina).
  const alerts = sup ? computeSupAlerts(sup) : null;

  // Coste mensual/anual estimado · igual que v1 `renderCostSupl`. Para
  // cada producto: precio_bote / gramos_bote * gramos_consumidos_mes.
  // Como aún no llevamos histórico mensual real, estimamos a partir de
  // la frecuencia semanal: cuántos días/semana toma el user × dosis.
  const batidoCostMes = sup ? estimarCosteMensual(sup, 'batido') : null;
  const creatinaCostMes = sup ? estimarCosteMensual(sup, 'creatina') : null;
  const totalMes =
    batidoCostMes !== null || creatinaCostMes !== null
      ? (batidoCostMes ?? 0) + (creatinaCostMes ?? 0)
      : null;
  const totalAnio = totalMes !== null ? totalMes * 12 : null;

  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Lista de "
            accent="compra"
            right={<AppAvatarButton />}
          />

          {/* ─── BLOQUE SUPLEMENTACIÓN (igual que v1) ─── */}
          {sup && batidoStats && creatinaStats && (
            <>
              <div className="compra-sup-card">
                <div className="compra-sup-cat-header">
                  <h2>💪 SUPLEMENTACIÓN</h2>
                </div>

                {/* Producto: Proteína */}
                <SupProductoRow
                  emoji="💪"
                  defaultName="Proteína"
                  nombre={sup.batidoConfig.producto_nombre}
                  precio={sup.batidoConfig.producto_precio}
                  stock={sup.batido_stock_gramos}
                  consumidos={batidoStats.gramosConsumidos}
                  restantesGramos={batidoStats.gramosRestantes}
                  alert={alerts?.batidoProt ?? null}
                  onEdit={() => setEditing('batido')}
                />

                {/* Producto: Creatina */}
                <SupProductoRow
                  emoji="🥄"
                  defaultName="Creatina"
                  nombre={sup.creatinaConfig.producto_nombre}
                  precio={sup.creatinaConfig.producto_precio}
                  stock={sup.creatina_stock_gramos}
                  consumidos={creatinaStats.gramosConsumidos}
                  restantesGramos={creatinaStats.gramosRestantes}
                  alert={alerts?.creatina ?? null}
                  onEdit={() => setEditing('creatina')}
                />

                {/* Badge unificado · capacidad MÁXIMA del bote actual ·
                    igual que v1 (`totalPosibles`, no `restantes`). El
                    user ve cuántos batidos podría hacer comprando este
                    bote. La info "cuántos te quedan AÚN por tomar" la
                    ve en HoyPage como "RESTANTES". */}
                <div className="compra-sup-badge-row">
                  <span className="compra-sup-badge-label">
                    Batidos que puedes hacer:
                  </span>
                  <span
                    className={
                      'compra-sup-badge'
                      + ((batidoStats.posibles ?? 0) < 7
                        ? ' compra-sup-badge--warn'
                        : '')
                    }
                  >
                    🥤{' '}
                    {batidoStats.posibles === null
                      ? '—'
                      : `${batidoStats.posibles} batido${
                          batidoStats.posibles === 1 ? '' : 's'
                        }`}
                  </span>
                </div>

                <p className="compra-sup-note">
                  Pulsa <strong>✏</strong> en cada producto para ajustar
                  nombre, precio y los gramos del bote.
                </p>
              </div>

              {/* Coste mensual / anual · igual que v1 */}
              {totalMes !== null && totalMes > 0 && (
                <div className="compra-sup-cost">
                  <div className="compra-sup-cost-label">
                    COSTE SUPLEMENTACIÓN
                  </div>
                  <div className="compra-sup-cost-grid">
                    <div className="compra-sup-cost-cell compra-sup-cost-cell--mes">
                      <span className="compra-sup-cost-period">/ MES</span>
                      <span className="compra-sup-cost-amount">
                        {fmtPrice(totalMes)}
                      </span>
                    </div>
                    <div className="compra-sup-cost-cell compra-sup-cost-cell--anio">
                      <span className="compra-sup-cost-period">/ AÑO</span>
                      <span className="compra-sup-cost-amount">
                        {fmtPrice(totalAnio ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Resto de la lista · placeholder hasta Fase 2C */}
          <div className="app-soon-card">
            <div className="app-soon-icon">
              <IonIcon icon={cartOutline} />
            </div>
            <h3>Lista por categorías · pronto</h3>
            <p>
              Frutas, proteínas, lácteos, hidratos, despensa y grasas se
              calcularán automáticamente desde tu plan nutricional. Por
              ahora solo está el bloque de suplementación.
            </p>
            <span className="app-soon-tag">Fase 2C · Compra completa</span>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>

        {/* Modal de edición · reutilizamos el mismo de HoyPage. */}
        {editing && (
          <EditSupStockModal
            isOpen={editing !== null}
            onClose={() => setEditing(null)}
            kind={editing}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default CompraPage;

// ──────────────────────────────────────────────────────────────────────────
// Sub-componentes locales
// ──────────────────────────────────────────────────────────────────────────

interface SupProductoRowProps {
  emoji: string;
  defaultName: string; // se muestra si nombre está vacío
  nombre: string;
  precio: number | null;
  stock: number | null;
  consumidos: number | null;
  restantesGramos: number | null;
  // Aviso v1-style ya calculado por el padre · null si no hay aviso.
  alert: SupAlert | null;
  onEdit: () => void;
}

// Una fila de producto dentro del bloque de suplementación · imagen
// (emoji) + nombre + precio + tracker (Consumido X g / Y g restantes)
// + alerta si quedan pocas dosis. Pulsando ✏ se abre el modal de edición.
function SupProductoRow({
  emoji,
  defaultName,
  nombre,
  precio,
  stock,
  consumidos,
  restantesGramos,
  alert,
  onEdit,
}: SupProductoRowProps) {
  const displayName = nombre.trim() || defaultName;
  const noStock = stock === null;
  // Clase del row · solo para colorear sutilmente el borde según el
  // nivel de la alerta. Si no hay alerta, sin clase modificadora.
  const cls = alert
    ? alert.level === 'danger'
      ? 'compra-sup-row--empty'
      : 'compra-sup-row--warn'
    : '';

  return (
    <div className={'compra-sup-row ' + cls}>
      <div className="compra-sup-row-head">
        <div className="compra-sup-row-emoji" aria-hidden="true">
          {emoji}
        </div>
        <div className="compra-sup-row-id">
          <span className="compra-sup-row-name">{displayName}</span>
          <span className="compra-sup-row-price">
            {precio === null ? '—' : fmtPrice(precio)}
          </span>
        </div>
        <button
          type="button"
          className="compra-sup-row-edit"
          onClick={blurAndRun(onEdit)}
          aria-label={`Editar ${displayName}`}
        >
          <IonIcon icon={pencilOutline} />
        </button>
      </div>

      {noStock ? (
        <button
          type="button"
          className="compra-sup-row-empty-cta"
          onClick={blurAndRun(onEdit)}
        >
          <IonIcon icon={flaskOutline} />
          Introduce los gramos comprados
        </button>
      ) : (
        <>
          <div className="compra-sup-row-tracker">
            <span className="compra-sup-tracker-label">Consumido:</span>
            <span className="compra-sup-tracker-num">
              {consumidos ?? 0}
            </span>
            <span className="compra-sup-tracker-unit">g</span>
            <span
              className={
                'compra-sup-tracker-rem'
                + (cls ? ' compra-sup-tracker-rem--warn' : '')
              }
            >
              {restantesGramos ?? 0}g restantes
            </span>
          </div>

          {/* Aviso v1-style · texto exacto "⚠ Queda poca proteína…" o
              "🚫 No queda…". Lo calcula el padre vía computeSupAlerts. */}
          {alert && <SupAlertBox alert={alert} />}
        </>
      )}
    </div>
  );
}

// Formatea un precio en € con 2 decimales · estilo "29,95 €" (coma
// decimal, espacio antes del símbolo · convención es-ES).
function fmtPrice(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

// Estimación del coste mensual basada en la frecuencia con que el user
// toma el suplemento (días/semana en `daysWithBatido` / `daysWithCreatina`)
// y el coste por dosis (precio_bote / gramos_bote × dosis_gramos).
function estimarCosteMensual(
  sup: import('../../templates/defaultUser').Suplementos,
  kind: 'batido' | 'creatina',
): number | null {
  const stock =
    kind === 'batido' ? sup.batido_stock_gramos : sup.creatina_stock_gramos;
  const dosis =
    kind === 'batido' ? sup.batidoConfig.gr_prot : sup.creatinaConfig.gr_dose;
  const precio =
    kind === 'batido'
      ? sup.batidoConfig.producto_precio
      : sup.creatinaConfig.producto_precio;
  if (precio === null || stock === null || stock === 0 || dosis <= 0) {
    return null;
  }
  // Coste por dosis = precio_bote / cuántas_dosis_tiene_el_bote
  const dosisPorBote = stock / dosis;
  if (dosisPorBote <= 0) return null;
  const costePorDosis = precio / dosisPorBote;
  // Frecuencia: cuántos días a la semana tomas → dosis/mes ≈ días×4.33
  const diasSemana =
    kind === 'batido'
      ? sup.daysWithBatido.length
      : sup.daysWithCreatina.length;
  if (diasSemana === 0) return 0;
  const dosisMes = diasSemana * 4.33;
  return Math.round(costePorDosis * dosisMes * 100) / 100;
}
