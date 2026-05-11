// Line chart SVG inline · evolución de una serie temporal pequeña
// (≤ 30 puntos). Más completo que el sparkline del RegDayPanel:
// añade eje Y con grid, etiquetas X y puntos clickables (vía title).

export interface LineChartDatum {
  label: string;   // ej. "5 may", "S20"
  value: number;
}

export interface LineChartProps {
  data: LineChartDatum[];
  unit?: string;     // "kg", "veces", etc.
  color?: string;    // default lima
  height?: number;   // default 180
  emptyMessage?: string;
  // Mostrar eje Y con valores min/max (default true)
  showYAxis?: boolean;
}

const DEFAULT_COLOR = 'var(--btal-lime)';
const PAD = { top: 14, right: 10, bottom: 28, left: 36 };

export function LineChart({
  data,
  unit = '',
  color = DEFAULT_COLOR,
  height = 180,
  emptyMessage = 'Sin datos suficientes para el gráfico.',
  showYAxis = true,
}: LineChartProps) {
  if (data.length < 2) {
    return <div className="bt-chart-empty">{emptyMessage}</div>;
  }

  const W = 320;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  // Evita división por cero si todos los valores son iguales · fuerza
  // un rango mínimo del 10% del valor o 1 (lo que sea mayor) para que
  // la línea no quede en el borde superior plana.
  const range = maxV - minV || Math.max(maxV * 0.1, 1);

  const xAt = (i: number) =>
    data.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (innerW * i) / (data.length - 1);
  const yAt = (v: number) =>
    PAD.top + innerH * (1 - (v - minV) / range);

  const points = data.map((d, i) => [xAt(i), yAt(d.value)] as const);
  const polyline = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Etiquetas X: si hay muchos puntos, mostrar solo cada N para no
  // saturar. Min 4 etiquetas visibles y max ~8.
  const labelStride = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="bt-line-chart"
      role="img"
      aria-label={`Gráfico de línea · ${data.length} puntos`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid Y · 3 líneas (top/mid/bottom) */}
      {showYAxis &&
        [0, 0.5, 1].map((frac) => {
          const y = PAD.top + innerH * frac;
          const v = maxV - range * frac;
          return (
            <g key={frac}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="var(--btal-border)"
                strokeWidth="0.6"
                strokeDasharray={frac === 1 ? '' : '2 3'}
              />
              <text
                x={PAD.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="'JetBrains Mono', monospace"
                fill="var(--btal-t-3)"
              >
                {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
              </text>
            </g>
          );
        })}

      {/* Polilinea */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />

      {/* Puntos */}
      {points.map(([x, y], i) => (
        <g key={`${i}-${data[i].label}`}>
          <circle cx={x} cy={y} r="2.5" fill={color}>
            <title>
              {data[i].label}: {data[i].value}
              {unit ? ` ${unit}` : ''}
            </title>
          </circle>
        </g>
      ))}

      {/* Etiquetas X (cada labelStride) */}
      {data.map((d, i) => {
        if (i % labelStride !== 0 && i !== data.length - 1) return null;
        const [x] = points[i];
        return (
          <text
            key={`xl-${i}`}
            x={x}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fontSize="9"
            fill="var(--btal-t-3)"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
