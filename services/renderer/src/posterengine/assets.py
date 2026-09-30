"""Acceso a los recursos compartidos de packages/themes (temas, formatos, maquetación, fuentes)."""

import json
import os
from functools import cache
from pathlib import Path

THEME_KEYS = (
    "bg",
    "text",
    "gradient_color",
    "water",
    "parks",
    "road_motorway",
    "road_primary",
    "road_secondary",
    "road_tertiary",
    "road_residential",
    "road_default",
)


def assets_dir() -> Path:
    env = os.environ.get("POSTER_ASSETS_DIR")
    if env:
        return Path(env)
    # services/renderer/src/posterengine -> repo root /packages/themes
    return Path(__file__).resolve().parents[4] / "packages" / "themes"


def _load(name: str) -> dict:
    with open(assets_dir() / name, encoding="utf-8") as f:
        return json.load(f)


@cache
def formats() -> dict:
    return _load("formats.json")


@cache
def layout() -> dict:
    return _load("layout.json")


@cache
def markers() -> dict:
    return _load("markers.json")


@cache
def fonts_catalog() -> dict:
    return _load("fonts.json")


@cache
def themes() -> dict[str, dict]:
    out = {}
    for path in sorted((assets_dir() / "themes").glob("*.json")):
        with open(path, encoding="utf-8") as f:
            out[path.stem] = json.load(f)
    return out


def get_format(format_id: str) -> dict:
    for fmt in formats()["formats"]:
        if fmt["id"] == format_id:
            return fmt
    raise KeyError(f"Formato desconocido: {format_id}")


def get_finish(finish_id: str) -> dict:
    for fin in formats()["finishes"]:
        if fin["id"] == finish_id:
            return fin
    raise KeyError(f"Acabado desconocido: {finish_id}")
