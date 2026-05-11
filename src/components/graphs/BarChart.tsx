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
}

const DEFAULT_COLOR = 'var(--btal-lime)';
// PAD.top más generoso para acomodar el texto del valor con halo
// oscuro · si el valor está cerca del borde superior, el halo (stroke)
// no debe quedar cortado.
const PAD = { top: 24, right: 8, bottom: 28, left: 8 };

export function BarChart({
  data,
  unit = '',
  showValues = true,
  color = DEFAULT_COLOR,
  height = 160,
  emptyMessage = 'Sin datos para mostrar.',
}: BarChartProps) {
  if (!data.length) {
    return <div className="bt-chart-empty">{emptyMessage}</div>;
  }

  // ViewBox fijo · el contenedor le da el width real responsive.
  const W = 320;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxV = Math.max(...data.map((d) => d.value), 1);
  // Espacio por barra · 70% barra + 30% gap
  const slot = innerW / data.length;
  const barW = slot * 0.65;
  const offset = slot * 0.175;

  // Etiqueta X rotada si hay >= 8 entries (no caben rectas).
  const rotateLabels = data.length >= 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="bt-bar-chart"
      role="img"
      aria-label={`Gráfico de barras · ${data.length} valores`}
      preserveAspectRatio="xMidYMid meet"
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
              textAnchor={rotateLabels ? 'end' : 'middle'}
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
}
