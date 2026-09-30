import Link from "next/link";
import { trimSizeCm } from "@/lib/assets";
import { resolvePalette, type PosterSpec } from "@/lib/spec";
import { PosterOverlay } from "./PosterOverlay";

/** Tarjeta de póster: miniatura renderizada si existe; si no, un marcador con tipografía y colores del tema. */
export function PosterCard({ href, spec, imageUrl, caption, sub }: { href: string; spec: PosterSpec; imageUrl?: string; caption: string; sub?: string }) {
  const [w, h] = trimSizeCm(spec.formatId, spec.orientation);
  const palette = resolvePalette(spec);
  const W = 300;
  const H = (W * h) / w;
  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden shadow-md transition group-hover:shadow-xl" style={{ aspectRatio: `${w} / ${h}`, background: palette.bg }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={caption} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            {Array.from({ length: 14 }, (_, i) => (
              <line key={`v${i}`} x1={(i * W) / 13 + (i % 3) * 4} y1={0} x2={(i * W) / 13 - 10} y2={H} stroke={i % 4 === 0 ? palette.road_primary : palette.road_residential} strokeWidth={i % 4 === 0 ? 1.2 : 0.5} />
            ))}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={(i * H) / 17} x2={W} y2={(i * H) / 17 + (i % 2) * 6} stroke={i % 5 === 0 ? palette.road_secondary : palette.road_residential} strokeWidth={i % 5 === 0 ? 1 : 0.5} />
            ))}
            <path d={`M0 ${H * 0.45} C ${W * 0.3} ${H * 0.38}, ${W * 0.6} ${H * 0.58}, ${W} ${H * 0.5} L ${W} ${H * 0.55} C ${W * 0.6} ${H * 0.63}, ${W * 0.3} ${H * 0.43}, 0 ${H * 0.5} Z`} fill={palette.water} />
          </svg>
        )}
        {!imageUrl && (
          <div className="absolute inset-0">
            <PosterOverlay spec={spec} palette={palette} width={W} height={H} />
          </div>
        )}
      </div>
      <p className="mt-3 text-sm font-medium">{caption}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </Link>
  );
}
