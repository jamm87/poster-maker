"""Proveedor de datos sintéticos (sin red): una ciudad ficticia con cuadrícula, avenidas, río y parques.

Se usa en tests y en desarrollo local (POSTER_DATA_PROVIDER=synthetic) cuando Overpass no es accesible.
"""

import math

import geopandas as gpd
from shapely.geometry import LineString, Polygon

from .osm_data import MapData


class SyntheticProvider:
    def __init__(self, spacing_deg: float = 0.004):
        self.spacing = spacing_deg
        self.calls: list[tuple] = []

    def fetch(self, bbox):
        self.calls.append(bbox)
        w, s, e, n = bbox
        cx, cy = (w + e) / 2, (s + n) / 2
        lines, kinds = [], []
        step = self.spacing
        i = 0
        x = w
        while x <= e:
            lines.append(LineString([(x, s), (x + (n - s) * 0.05, n)]))
            kinds.append("primary" if i % 8 == 0 else "tertiary" if i % 4 == 0 else "residential")
            x += step
            i += 1
        i = 0
        y = s
        while y <= n:
            lines.append(LineString([(w, y), (e, y)]))
            kinds.append("secondary" if i % 6 == 0 else "residential")
            y += step
            i += 1
        # ronda circular y autopista diagonal
        r = min(e - w, n - s) * 0.3
        ring = [
            (cx + r * math.cos(t / 40 * 2 * math.pi), cy + r * 0.8 * math.sin(t / 40 * 2 * math.pi)) for t in range(41)
        ]
        lines.append(LineString(ring))
        kinds.append(["motorway", "motorway_link"])
        lines.append(LineString([(w, s), (e, n)]))
        kinds.append("motorway")
        lines.append(LineString([(w, n), (cx, cy)]))
        kinds.append("footway")
        roads = gpd.GeoDataFrame({"highway": kinds}, geometry=lines, crs="EPSG:4326")

        river = Polygon(
            [(w + (e - w) * k / 100, cy - 0.003 + 0.004 * math.sin(k / 8)) for k in range(101)]
            + [(w + (e - w) * k / 100, cy + 0.003 + 0.004 * math.sin(k / 8)) for k in range(100, -1, -1)]
        )
        lake = Polygon(
            [(cx + 0.01, cy + 0.01), (cx + 0.02, cy + 0.01), (cx + 0.02, cy + 0.018), (cx + 0.01, cy + 0.018)],
            holes=[[(cx + 0.013, cy + 0.012), (cx + 0.016, cy + 0.012), (cx + 0.016, cy + 0.015)]],
        )
        water = gpd.GeoDataFrame(geometry=[river, lake], crs="EPSG:4326")
        park = Polygon(
            [(cx - 0.02, cy + 0.01), (cx - 0.008, cy + 0.01), (cx - 0.008, cy + 0.02), (cx - 0.02, cy + 0.02)]
        )
        parks = gpd.GeoDataFrame(geometry=[park], crs="EPSG:4326")
        return MapData(roads=roads, water=water, parks=parks)
