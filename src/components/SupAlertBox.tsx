import type { SupAlert } from '../utils/supAlerts';
import './SupModal.css';

interface Props {
  alert: SupAlert;
}

// Componente render-only · pinta una alerta de stock bajo (warn) o
// vacío (danger) replicando los textos exactos del v1 `setAlert`.
//
// Mensajes:
//   - danger (0 unidades posibles): 🚫 "No queda <prod> (Xg). Compra cuanto antes."
//   - warn  (≤7 unidades posibles): ⚠ "Queda poca <prod> (Yg — para Z <unit>). Hace falta comprar."
//
// Usado en SupCountersInline (Menú), SupCardHoy (Hoy) y CompraPage row.
export function SupAlertBox({ alert }: Props) {
  const grRest = Math.max(0, alert.gramosRestantes);
  if (alert.level === 'danger') {
    return (
      <div className="sup-alert sup-alert--danger">
        <span>
          🚫 <strong>No queda {alert.productoLabel}</strong> ({grRest}g).{' '}
          <strong>Compra cuanto antes.</strong>
        </span>
      </div>
    );
  }
  // warn · "para X batido(s)" o "para X dosis(s)" según unitLabel.
  const unitText =
    alert.unitLabel === 'batido'
      ? alert.unidadesRestantes === 1
        ? 'batido'
        : 'batidos'
      : 'dosis'; // dosis es invariable en plural
  return (
    <div className="sup-alert sup-alert--warn">
      <span>
        ⚠ <strong>Queda poca {alert.productoLabel}</strong> ({grRest}g — para{' '}
        {alert.unidadesRestantes} {unitText}).{' '}
        <strong>Hace falta comprar.</strong>
      </span>
    </div>
  );
}
