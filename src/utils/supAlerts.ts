// Alertas de stock bajo / vacío para batido y creatina · réplica
// fiel del helper `setAlert` del v1. Devuelve los datos necesarios
// para que un componente render-only (SupAlertBox) pinte el aviso.
//
// Reglas v1 (`setAlert(el, unitsRestantes, productoLabel, grRestantes, unitSing)`):
//   - unitsRestantes === null  → no mostrar nada (sin stock definido).
//   - unitsRestantes === 0     → 🚫 "No queda X (0g). Compra cuanto antes." (rojo)
//   - unitsRestantes <= 7      → ⚠ "Queda poco X (Yg — para Z {unit}). Hace falta comprar." (naranja)
//   - resto                    → no mostrar.
//
// Para el batido se generan DOS alertas independientes (proteína y
// creatina si includeCreatina). Para la creatina suelta una sola.

import {
  calcBatidoStats,
  calcCreatinaStats,
  type Suplementos,
} from '../templates/defaultUser';

export type SupAlertLevel = 'warn' | 'danger';

export interface SupAlert {
  level: SupAlertLevel;
  // 'proteína' o 'creatina' · texto que aparece tras "Queda poca…".
  productoLabel: 'proteína' | 'creatina';
  // 'batido' o 'dosis' · unidad de medida del recurso restante.
  unitLabel: 'batido' | 'dosis';
  gramosRestantes: number; // gramos del bote tras descontar consumo
  unidadesRestantes: number; // batidos posibles o dosis posibles
}

export interface SupAlertsByContext {
  // Modal/card del BATIDO · alerta sobre el stock de proteína.
  batidoProt: SupAlert | null;
  // Modal/card del BATIDO · alerta sobre el stock de creatina (solo si
  // includeCreatina). Si el user no incluye creatina en el batido, esta
  // alerta no aparece aunque la creatina se esté agotando · porque para
  // el batido en sí no afecta.
  batidoCreat: SupAlert | null;
  // Modal/card de la CREATINA suelta · alerta sobre el stock de creatina
  // descontando lo ya usado por batidos (si includeCreatina).
  creatina: SupAlert | null;
}

const ALERT_THRESHOLD = 7;

// Helper genérico · construye una SupAlert según los gramos restantes
// y la dosis. Devuelve null si no hay stock definido o si las unidades
// restantes superan el umbral (no hace falta avisar).
function buildAlert(
  gramosRestantes: number | null,
  dosisGramos: number,
  productoLabel: SupAlert['productoLabel'],
  unitLabel: SupAlert['unitLabel'],
): SupAlert | null {
  if (gramosRestantes === null || dosisGramos <= 0) return null;
  // floor · el v1 usa Math.floor: si quedan 2g de creatina y dosis=3g,
  // floor(2/3)=0 → "no quedan dosis". Si quedan 4g, floor(4/3)=1 → 1 dosis.
  const unidades = Math.floor(gramosRestantes / dosisGramos);
  if (unidades === 0) {
    return {
      level: 'danger',
      productoLabel,
      unitLabel,
      gramosRestantes,
      unidadesRestantes: 0,
    };
  }
  if (unidades <= ALERT_THRESHOLD) {
    return {
      level: 'warn',
      productoLabel,
      unitLabel,
      gramosRestantes,
      unidadesRestantes: unidades,
    };
  }
  return null;
}

export function computeSupAlerts(sup: Suplementos): SupAlertsByContext {
  // Batido · proteína. calcBatidoStats.gramosRestantes mide solo proteína
  // (protStock - protConsumido).
  const batidoStats = calcBatidoStats(sup);
  const batidoProt = buildAlert(
    batidoStats.gramosRestantes,
    sup.batidoConfig.gr_prot,
    'proteína',
    'batido',
  );

  // Creatina · stats descuenta consumo por batidos + dosis sueltas.
  const creatinaStats = calcCreatinaStats(sup);
  const creatinaAlert = buildAlert(
    creatinaStats.gramosRestantes,
    sup.creatinaConfig.gr_dose,
    'creatina',
    'dosis',
  );

  // En el modal del BATIDO solo mostramos la alerta de creatina si el
  // batido la incluye · si includeCreatina=false, la creatina no afecta
  // al batido y no tiene sentido avisar ahí (el aviso seguirá saliendo
  // en el modal de la creatina).
  const batidoCreat = sup.batidoConfig.includeCreatina ? creatinaAlert : null;

  return {
    batidoProt,
    batidoCreat,
    creatina: creatinaAlert,
  };
}
