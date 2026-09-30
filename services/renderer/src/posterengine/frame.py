"""Encuadre del mapa: centro + ancho visible en metros -> rectángulo métrico y bbox WGS84.

Sustituye a `compensated_dist` / `get_crop_limits` del script original por un encuadre explícito,
compartido con la vista previa MapLibre de la web (misma fórmula en apps/web/lib/frame.ts).
"""

from dataclasses import dataclass

from pyproj import CRS, Transformer


@dataclass(frozen=True)
class Frame:
    crs: CRS
    # extensión métrica (en la proyección local) del lienzo completo (corte + sangrado)
    xmin: float
    xmax: float
    ymin: float
    ymax: float
    # bbox WGS84 a descargar (lienzo + margen): (west, south, east, north)
    fetch_bbox: tuple[float, float, float, float]

    def to_local(self) -> Transformer:
        return Transformer.from_crs("EPSG:4326", self.crs, always_xy=True)


def local_crs(lat: float, lon: float) -> CRS:
    """Transversa de Mercator centrada en el punto: distancias fieles alrededor del centro."""
    return CRS.from_proj4(f"+proj=tmerc +lat_0={lat} +lon_0={lon} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m")


def compute_frame(
    lat: float,
    lon: float,
    width_meters: float,
    trim_w: float,
    trim_h: float,
    bleed_w: float = 0.0,
    margin: float = 0.10,
) -> Frame:
    """trim_w/trim_h/bleed_w en cualquier unidad física común (p. ej. mm)."""
    m_per_unit = width_meters / trim_w
    half_w = (trim_w / 2 + bleed_w) * m_per_unit
    half_h = (trim_h / 2 + bleed_w) * m_per_unit
    crs = local_crs(lat, lon)
    to_geo = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    fw, fh = half_w * (1 + margin), half_h * (1 + margin)
    xs, ys = to_geo.transform([-fw, fw, fw, -fw], [-fh, -fh, fh, fh])
    bbox = (min(xs), min(ys), max(xs), max(ys))
    return Frame(crs, -half_w, half_w, -half_h, half_h, bbox)
