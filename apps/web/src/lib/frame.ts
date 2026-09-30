/**
 * Encuadre compartido con el renderer (services/renderer/src/posterengine/frame.py).
 * El póster muestra `widthMeters` de ancho centrados en `center`. En la vista previa MapLibre
 * (Web Mercator, teselas de 512 px) eso fija el zoom para un ancho de contenedor dado.
 */

const EARTH_CIRCUMFERENCE = 40075016.686; // m, ecuador (esfera WGS84)
const TILE_SIZE = 512;
const R = EARTH_CIRCUMFERENCE / (2 * Math.PI);

export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

export function zoomForWidth(lat: number, widthMeters: number, containerWidthPx: number): number {
  return Math.log2((EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180) * containerWidthPx) / (TILE_SIZE * widthMeters));
}

export function widthForZoom(lat: number, zoom: number, containerWidthPx: number): number {
  return metersPerPixel(lat, zoom) * containerWidthPx;
}

/** bbox [W, S, E, N] del área de corte, aproximación local de Mercator (≈ tmerc del renderer). */
export function trimBbox(lat: number, lon: number, widthMeters: number, trimW: number, trimH: number): [number, number, number, number] {
  const halfW = widthMeters / 2;
  const halfH = (widthMeters * trimH) / trimW / 2;
  const phi = (lat * Math.PI) / 180;
  const dLon = (halfW / (R * Math.cos(phi))) * (180 / Math.PI);
  // En Mercator la escala a latitud phi es 1/cos(phi): convertimos metros reales a y-Mercator.
  const y0 = Math.log(Math.tan(Math.PI / 4 + phi / 2));
  const dy = halfH / (R * Math.cos(phi));
  const toLat = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
  return [lon - dLon, toLat(y0 - dy), lon + dLon, toLat(y0 + dy)];
}

/** Anchura sugerida (m) para un resultado del geocodificador según su extensión o tipo. */
export function suggestedWidth(extent: [number, number, number, number] | undefined, type?: string): number {
  if (extent) {
    const [w, , e] = extent;
    const midLat = (extent[1] + extent[3]) / 2;
    const meters = Math.abs(e - w) * (Math.PI / 180) * R * Math.cos((midLat * Math.PI) / 180);
    return clampWidth(meters * 0.8);
  }
  switch (type) {
    case "city":
      return 12000;
    case "district":
    case "locality":
      return 5000;
    case "street":
    case "house":
      return 2500;
    default:
      return 8000;
  }
}

export function clampWidth(meters: number): number {
  return Math.round(Math.min(60000, Math.max(1000, meters)));
}
