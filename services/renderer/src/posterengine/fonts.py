"""Carga de tipografías: Roboto local o Google Fonts con caché.

Adaptado de font_management.py (maptoposter). Devuelve rutas por peso: light/regular/bold.
"""

import logging
import os
import re
from pathlib import Path

import requests

from . import assets

log = logging.getLogger(__name__)
WEIGHTS = {300: "light", 400: "regular", 700: "bold"}


def _cache_dir() -> Path:
    d = Path(os.environ.get("FONT_CACHE_DIR", "cache/fonts"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def local_roboto() -> dict[str, str]:
    base = assets.assets_dir() / "fonts"
    return {
        "bold": str(base / "Roboto-Bold.ttf"),
        "regular": str(base / "Roboto-Regular.ttf"),
        "light": str(base / "Roboto-Light.ttf"),
    }


def _download_google_font(family: str) -> dict[str, str] | None:
    safe = family.replace(" ", "_").lower()
    cache = _cache_dir()
    cached = {k: cache / f"{safe}_{k}.ttf" for k in WEIGHTS.values()}
    if all(p.exists() for p in cached.values()):
        return {k: str(p) for k, p in cached.items()}
    # Sin User-Agent de navegador Google devuelve TTF (matplotlib no lee woff2).
    resp = requests.get(
        "https://fonts.googleapis.com/css2",
        params={"family": f"{family}:wght@300;400;700"},
        timeout=20,
    )
    resp.raise_for_status()
    urls: dict[int, str] = {}
    for block in re.split(r"@font-face\s*\{", resp.text)[1:]:
        wm = re.search(r"font-weight:\s*(\d+)", block)
        um = re.search(r"url\((https://[^)]+)\)", block)
        if wm and um:
            urls.setdefault(int(wm.group(1)), um.group(1))
    if not urls:
        return None
    out = {}
    for weight, key in WEIGHTS.items():
        url = urls.get(weight) or urls[min(urls, key=lambda w: abs(w - weight))]
        path = cached[key]
        if not path.exists():
            data = requests.get(url, timeout=30)
            data.raise_for_status()
            path.write_bytes(data.content)
        out[key] = str(path)
    return out


def load_fonts(family: str | None) -> dict[str, str]:
    if not family or family.lower() == "roboto":
        return local_roboto()
    try:
        fonts = _download_google_font(family)
        if fonts:
            return fonts
    except Exception as e:  # noqa: BLE001 - la tipografía nunca debe romper el render
        log.warning("No se pudo cargar '%s' (%s); se usa Roboto", family, e)
    return local_roboto()
