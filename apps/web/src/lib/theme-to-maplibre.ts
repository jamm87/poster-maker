import type { StyleSpecification, LayerSpecification, FilterSpecification } from "maplibre-gl";
import { layout, type Palette } from "./assets";

/**
 * Convierte un tema del repo (paleta de 11 colores) en un estilo MapLibre sobre teselas OpenMapTiles
 * (OpenFreeMap). Replica la jerarquía de calles de create_map_poster.py: grosores proporcionales al
 * lado menor del póster, igual que el renderer Python, para que la vista previa se parezca al archivo final.
 */

export const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";

type RoadClass = keyof typeof layout.roads & ("motorway" | "primary" | "secondary" | "tertiary" | "residential" | "default");

/** Clases de `transportation` (OpenMapTiles) → clase de calle del repo. */
export const OMT_ROAD_CLASSES: Record<Exclude<RoadClass, "default">, string[]> = {
  motorway: ["motorway"],
  primary: ["trunk", "primary"],
  secondary: ["secondary"],
  tertiary: ["tertiary"],
  residential: ["minor"],
};
const DEFAULT_CLASSES = ["service", "track", "path", "raceway", "busway"];

const DRAW_ORDER: RoadClass[] = ["default", "residential", "tertiary", "secondary", "primary", "motorway"];

export function roadWidthPx(cls: RoadClass, minSidePx: number): number {
  const frac = (layout.roads[cls] as { width: number }).width;
  // MapLibre no dibuja bien líneas por debajo de ~0.3 px; se compensa con opacidad en roadOpacity.
  return Math.max(frac * minSidePx, 0.3);
}

function roadOpacity(cls: RoadClass, minSidePx: number): number {
  const frac = (layout.roads[cls] as { width: number }).width;
  return Math.min(1, (frac * minSidePx) / 0.3);
}

export function buildMapStyle(palette: Palette, minSidePx: number, tilejsonUrl = OPENFREEMAP_TILEJSON): StyleSpecification {
  const roadLayers: LayerSpecification[] = DRAW_ORDER.map((cls) => {
    const classes = cls === "default" ? DEFAULT_CLASSES : OMT_ROAD_CLASSES[cls];
    const colorKey = (layout.roads[cls] as { color: keyof Palette }).color;
    const filter: FilterSpecification = [
      "all",
      ["==", ["geometry-type"], "LineString"],
      ["in", ["get", "class"], ["literal", classes]],
    ];
    return {
      id: `road-${cls}`,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette[colorKey],
        "line-width": roadWidthPx(cls, minSidePx),
        "line-opacity": roadOpacity(cls, minSidePx),
      },
    };
  });

  return {
    version: 8,
    sources: { omt: { type: "vector", url: tilejsonUrl, attribution: "© OpenStreetMap contributors · OpenFreeMap" } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": palette.bg } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": palette.water, "fill-antialias": false } },
      {
        id: "parks",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": palette.parks, "fill-antialias": false },
      },
      {
        id: "grass",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "grass"],
        paint: { "fill-color": palette.parks, "fill-antialias": false },
      },
      ...roadLayers,
    ],
  };
}
