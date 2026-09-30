import { layout } from "@/lib/assets";
import { formatCoords, titleSizeFrac, titleText } from "@/lib/poster-layout";
import type { Palette } from "@/lib/assets";
import type { PosterSpec } from "@/lib/spec";

/**
 * Capa de tipografía y degradados sobre el mapa, con la misma maquetación que el renderer Python
 * (packages/themes/layout.json). width/height = tamaño en px del área de corte en pantalla.
 */
// Conserva los espacios (el título latino se espacia con dos espacios entre letras, como en el renderer)
const PRE = { whiteSpace: "pre" } as const;

export function PosterOverlay({
  spec,
  palette,
  width,
  height,
  watermark,
}: {
  spec: PosterSpec;
  palette: Palette;
  width: number;
  height: number;
  watermark?: string;
}) {
  if (!width || !height) return null;
  const min = Math.min(width, height);
  const y = (frac: number) => height * (1 - frac);
  const size = (frac: number) => frac * min;
  const t = spec.texts;
  const font = `'${spec.fontFamily}', Roboto, Helvetica, Arial, sans-serif`;
  const gh = layout.gradient.height * height;
  const coords = t.coords || formatCoords(spec.center.lat, spec.center.lon);
  const d = layout.divider;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ fontFamily: font }}
    >
      <defs>
        <linearGradient id="fade-bottom" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={palette.gradient_color} stopOpacity="1" />
          <stop offset="1" stopColor={palette.gradient_color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fade-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.gradient_color} stopOpacity="1" />
          <stop offset="1" stopColor={palette.gradient_color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y={height - gh} width={width} height={gh} fill="url(#fade-bottom)" />
      <rect x="0" y="0" width={width} height={gh} fill="url(#fade-top)" />
      <g fill={palette.text} textAnchor="middle">
        <text style={PRE} x={width / 2} y={y(layout.title.y)} fontSize={size(titleSizeFrac(t.title))} fontWeight={700}>
          {titleText(t.title)}
        </text>
        {t.subtitle && (
          <text style={PRE} x={width / 2} y={y(layout.subtitle.y)} fontSize={size(layout.subtitle.size)} fontWeight={300}>
            {t.subtitle.toUpperCase()}
          </text>
        )}
        {t.showCoords && (
          <text style={PRE} x={width / 2} y={y(layout.coords.y)} fontSize={size(layout.coords.size)} fillOpacity={layout.coords.alpha}>
            {coords}
          </text>
        )}
        {t.dedication && (
          <text
            style={PRE}
            x={width / 2}
            y={y(layout.dedication.y)}
            fontSize={size(layout.dedication.size)}
            fontWeight={300}
            fillOpacity={layout.dedication.alpha}
          >
            {t.dedication}
          </text>
        )}
        <text
            style={PRE}
          x={width * layout.attribution.x}
          y={y(layout.attribution.y)}
          fontSize={Math.max(size(layout.attribution.size), 6)}
          fontWeight={300}
          fillOpacity={layout.attribution.alpha}
          textAnchor="end"
        >
          {layout.attribution.text}
        </text>
      </g>
      <line
        x1={width * d.x0}
        x2={width * d.x1}
        y1={y(d.y)}
        y2={y(d.y)}
        stroke={palette.text}
        strokeWidth={Math.max(d.width * min, 0.5)}
      />
      {watermark &&
        [0.12, 0.32, 0.52, 0.72, 0.92].map((f) => (
          <text
            style={PRE}
            key={f}
            x={width / 2}
            y={height * (1 - f)}
            fontSize={0.05 * min}
            fontWeight={700}
            fill={palette.text}
            fillOpacity={0.13}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-30 ${width / 2} ${height * (1 - f)})`}
          >
            {watermark}
          </text>
        ))}
    </svg>
  );
}
