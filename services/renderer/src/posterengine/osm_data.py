"""Descarga de datos de OpenStreetMap (calles, agua, parques) con caché en disco.

Basado en fetch_graph()/fetch_features() de create_map_poster.py. Diferencias:
- descarga por bbox explícito (no por punto + distancia);
- la caché se indexa por bbox ajustado a una rejilla, para reutilizar descargas de encuadres cercanos;
- el proveedor es intercambiable (los tests usan datos sintéticos, sin red).
"""

import hashlib
import logging
import math
import os
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import geopandas as gpd

log = logging.getLogger(__name__)

WATER_TAGS = {"natural": ["water", "bay", "strait"], "waterway": "riverbank"}
PARK_TAGS = {"leisure": "park", "landuse": "grass"}
GRID = 0.01  # grados


@dataclass
class MapData:
    roads: gpd.GeoDataFrame  # líneas WGS84 con columna 'highway'
    water: gpd.GeoDataFrame | None
    parks: gpd.GeoDataFrame | None


class MapDataProvider(Protocol):
    def fetch(self, bbox: tuple[float, float, float, float]) -> MapData: ...


def snap_bbox(bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    w, s, e, n = bbox
    return (
        math.floor(w / GRID) * GRID,
        math.floor(s / GRID) * GRID,
        math.ceil(e / GRID) * GRID,
        math.ceil(n / GRID) * GRID,
    )


class OSMnxProvider:
    """Descarga vía Overpass (OSMnx). Configurable con OVERPASS_URL y OSM_CACHE_DIR."""

    def __init__(self, cache_dir: str | None = None):
        import osmnx as ox

        self.ox = ox
        self.cache_dir = Path(cache_dir or os.environ.get("OSM_CACHE_DIR", "cache/osm"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        ox.settings.use_cache = True
        ox.settings.cache_folder = str(self.cache_dir / "http")
        ox.settings.requests_timeout = int(os.environ.get("OVERPASS_TIMEOUT", "300"))
        ox.settings.http_user_agent = os.environ.get("OSM_USER_AGENT", "poster-maker/0.1 (contacto: ver web)")
        if os.environ.get("OVERPASS_URL"):
            ox.settings.overpass_url = os.environ["OVERPASS_URL"]

    def _cached(self, name: str, bbox, loader):
        key = hashlib.sha1(f"{name}:{bbox}".encode()).hexdigest()[:16]
        path = self.cache_dir / f"{name}_{key}.pkl"
        if path.exists():
            log.info("cache hit %s %s", name, bbox)
            with open(path, "rb") as f:
                return pickle.load(f)
        value = loader()
        tmp = path.with_suffix(".tmp")
        with open(tmp, "wb") as f:
            pickle.dump(value, f, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(path)
        return value

    def _roads(self, bbox):
        g = self.ox.graph_from_bbox(bbox, network_type="all", truncate_by_edge=True, retain_all=True)
        edges = self.ox.graph_to_gdfs(g, nodes=False, fill_edge_geometry=True)
        return edges[["highway", "geometry"]].reset_index(drop=True)

    def _features(self, bbox, tags):
        try:
            gdf = self.ox.features_from_bbox(bbox, tags=tags)
        except self.ox._errors.InsufficientResponseError:
            return None
        gdf = gdf[gdf.geometry.type.isin(["Polygon", "MultiPolygon"])]
        return gdf[["geometry"]].reset_index(drop=True)

    def fetch(self, bbox):
        sb = snap_bbox(bbox)
        roads = self._cached("roads", sb, lambda: self._roads(sb))
        water = self._cached("water", sb, lambda: self._features(sb, WATER_TAGS))
        parks = self._cached("parks", sb, lambda: self._features(sb, PARK_TAGS))
        return MapData(roads=roads, water=water, parks=parks)
