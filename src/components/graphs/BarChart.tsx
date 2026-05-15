// Bar chart SVG inline · sin dependencias. Pensado para listas
// pequeñas (4-12 entries) tipo "entrenos por semana", "batidos por
// mes", etc. Auto-escala al max value y dibuja eje X con etiquetas
// rotadas si hay muchos puntos.

export interface BarChartDatum {
  label: string;   // texto bajo la barra (ej. "S20", "Mar", "2026")
  value: number;
  // Highlight opcional · pinta la barra en oro/coral en lugar de
  // lima. Útil para marcar el periodo actual o un récord.
  highlight?: 'gold' | 'coral' | null;
}

export interface BarChartProps {
  data: BarChartDatum[];
  // Unidad para el tooltip / aria-label · "días", "kg", etc.
  unit?: string;
  // Si true muestra el valor encima de cada barra (default true).
  showValues?: boolean;
  // Color base · default lima.
  color?: string;
  // Alto del SVG · default 160. El ancho es siempre 100% del contenedor.
  height?: number;
  // Texto a mostrar cuando data.length === 0.
  emptyMessage?: string;
  // Modo scroll horizontal · para charts con labels largas (PR's con
  // nombres de ejercicio · Rachas con rangos de fecha "05-01–05-30").
  // El SVG crece a un ancho intrínseco generoso (slot fijo por barra)
  // y el contenedor permite scroll-x · cada label tiene sitio para
  // verse completa sin solaparse ni cortarse. Default false (charts
  // cortos tipo "entrenos/semana" siguen escalando a 100% del ancho).
  scrollable?: boolean;
}

const DEFAULT_COLOR = 'var(--btal-lime)';
// Px por barra en modo scrollable · ancho cómodo para que una label
// rotada de ~12 chars no se solape con la vecina.
const SLOT_PX = 60;

export function BarChart({
  data,
  unit = '',
  showValues = true,
  color = DEFAULT_COLOR,
  height = 160,
  emptyMessage = 'Sin datos para mostrar.',
  scrollable = false,
}: BarChartProps) {
  if (!data.length) {
    return <div className="bt-chart-empty">{emptyMessage}</div>;
  }

  // Etiqueta X rotada si hay >= 8 entries (no caben rectas) o si el
  // chart es scrollable (labels largas tipo fecha/ejercicio).
  const rotateLabels = data.length >= 8 || scrollable;

  // Geometría de la label rotada: con bottom fijo las labels largas
  // (PR's = nombre de ejercicio ~18 chars · Rachas = rango de fecha)
  // sobresalían por debajo del viewBox y la primera por la izquierda,
  // y el SVG las recortaba. Derivamos el padding del largo real.
  const ROT_DEG = 35;
  const sinA = Math.sin((ROT_DEG * Math.PI) / 180);
  // Ancho aprox de la label más larga a fontSize 9. Estimamos generoso
  // (~6.2 px/char) porque la fuente del sistema en iOS (San Francisco)
  // es más ancha que el sans por defecto · subestimar = recorte.
  const labelPx =
    data.reduce((m, d) => Math.max(m, d.label.length), 0) * 6.2;
  // Caída vertical bajo la línea base que ocupa la label rotada
  // (+14 del offset del texto, +14 de descendente + margen de holgura
  // para que ni la más larga roce el borde inferior del viewBox).
  const labelDrop = rotateLabels ? Math.ceil(labelPx * sinA) + 28 : 18;

  const baseBottom = scrollable ? 44 : 28;
  // PAD.top generoso para el halo del valor. NO reservamos hueco extra
  // a la izquierda para la 1ª label rotada: eso desplazaba el chart a
  // la derecha dejando un gran vacío. Ahora la gráfica queda centrada
  // y, si una fecha/nombre largo no se ve entero, el usuario hace
  // scroll interno (la label va centrada bajo su barra, anchor=middle).
  const PAD = {
    top: 24,
    right: 8,
    bottom: Math.max(baseBottom, labelDrop),
    left: 8,
  };

  // ViewBox: 320 fijo en modo normal (escala a 100% del contenedor).
  // En scrollable, ancho intrínseco = nº barras × SLOT_PX (mín 320) ·
  // el contenedor le da scroll-x si excede el ancho visible.
  const W = scrollable ? Math.max(320, data.length * SLOT_PX) : 320;
  // Crecemos el alto total por el extra de bottom · así las barras
  // conservan su tamaño en vez de encogerse para dejar sitio a labels.
  const H = height + Math.max(0, PAD.bottom - baseBottom);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxV = Math.max(...data.map((d) => d.value), 1);
  // Espacio por barra · 70% barra + 30% gap
  const slot = innerW / data.length;
  const barW = slot * 0.65;
  const offset = slot * 0.175;

  const svg = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={'bt-bar-chart' + (scrollable ? ' bt-bar-chart--scroll' : '')}
      role="img"
      aria-label={`Gráfico de barras · ${data.length} valores`}
      preserveAspectRatio="xMidYMid meet"
      // En scrollable damos width/height intrínsecos en px para que el
      // contenedor (overflow-x:auto) pueda scrollear · sin esto el CSS
      // width:100% lo aplastaría al ancho visible y volverían a cortarse.
      {...(scrollable ? { width: W, height: H } : {})}
    >
      {/* Línea base */}
      <line
        x1={PAD.left}
        y1={H - PAD.bottom}
        x2={W - PAD.right}
        y2={H - PAD.bottom}
        stroke="var(--btal-border)"
        strokeWidth="1"
      />

      {data.map((d, i) => {
        const h = (d.value / maxV) * innerH;
        const x = PAD.left + slot * i + offset;
        const y = H - PAD.bottom - h;
        const fill =
          d.highlight === 'gold'
            ? 'var(--btal-gold)'
            : d.highlight === 'coral'
              ? 'var(--btal-coral)'
              : color;
        const cx = x + barW / 2;
        return (
          <g key={`${i}-${d.label}`}>
            {/* Barra */}
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, d.value > 0 ? 1.5 : 0)}
              fill={fill}
              rx="2"
            >
              <title>
                {d.label}: {d.value}
                {unit ? ` ${unit}` : ''}
              </title>
            </rect>
            {/* Valor encima de la barra · `paint-order: stroke` dibuja
                primero el stroke oscuro y encima el fill claro, dando
                un halo que mantiene legible el número sobre cualquier
                color de barra (lima, violeta, oro, coral). */}
            {showValues && d.value > 0 && (
              <text
                x={cx}
                y={Math.max(y - 7, PAD.top - 2)}
                textAnchor="middle"
                fontSize="12"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="800"
                fill="var(--btal-t-1)"
                stroke="var(--btal-bg)"
                strokeWidth="3"
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {d.value}
              </text>
            )}
            {/* Label X */}
            <text
              x={cx}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize="9"
              fill="var(--btal-t-3)"
              transform={
                rotateLabels
                  ? `rotate(-35 ${cx} ${H - PAD.bottom + 14})`
                  : undefined
              }
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );

  if (scrollable) {
    return <div className="bt-bar-chart-scroll">{svg}</div>;
  }
  return svg;
}
