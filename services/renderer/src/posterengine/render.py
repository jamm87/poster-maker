"""Render de pósters. Núcleo derivado de create_poster() de maptoposter, convertido en función pura:

- sin estado global (el tema viaja en el PosterSpec) y sin pyplot, apto para un worker de larga vida;
- tamaño de salida exacto en píxeles (sin bbox_inches="tight") y sangrado opcional para imprenta;
- maquetación proporcional al lado menor, así el diseño es idéntico en A4 o en 70×100 y en la vista previa web.
"""

import io
import logging
from dataclasses import dataclass
from typing import Literal

import matplotlib

matplotlib.use("Agg")

import matplotlib.colors as mcolors  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.backends.backend_agg import FigureCanvasAgg  # noqa: E402
from matplotlib.collections import LineCollection, PolyCollection  # noqa: E402
from matplotlib.figure import Figure  # noqa: E402
from matplotlib.font_manager import FontProperties  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402

from . import assets  # noqa: E402
from .fonts import load_fonts  # noqa: E402
from .frame import Frame, compute_frame  # noqa: E402
from .osm_data import MapData, MapDataProvider  # noqa: E402
from .spec import PosterSpec  # noqa: E402

log = logging.getLogger(__name__)

Mode = Literal["preview", "proof", "print"]
OutFormat = Literal["png", "pdf"]
MM_PER_IN = 25.4
PT_PER_IN = 72.0


@dataclass
class RenderResult:
    data: bytes
    content_type: str
    width_px: int
    height_px: int
    dpi: float
    bleed_mm: float


# --- Jerarquía de calles (get_edge_colors_by_type / get_edge_widths_by_type del original) ---

ROAD_CLASSES = ("default", "residential", "tertiary", "secondary", "primary", "motorway")  # orden de dibujo


def road_class(highway) -> str:
    if isinstance(highway, list):
        highway = highway[0] if highway else "unclassified"
    if highway in ("motorway", "motorway_link"):
        return "motorway"
    if highway in ("trunk", "trunk_link", "primary", "primary_link"):
        return "primary"
    if highway in ("secondary", "secondary_link"):
        return "secondary"
    if highway in ("tertiary", "tertiary_link"):
        return "tertiary"
    if highway in ("residential", "living_street", "unclassified"):
        return "residential"
    return "default"


def is_latin_script(text: str) -> bool:
    """>80 % de caracteres alfabéticos en rangos latinos (copiado del original)."""
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return True
    return sum(1 for c in alpha if ord(c) < 0x250) / len(alpha) > 0.8


def format_coords(lat: float, lon: float) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{abs(lat):.4f}° {ns} / {abs(lon):.4f}° {ew}"


def title_text(title: str) -> str:
    if is_latin_script(title):
        return (" " * assets.layout()["title"]["letterSpacingSpaces"]).join(title.upper())
    return title


def title_size_frac(title: str) -> float:
    cfg = assets.layout()["title"]
    n = len(title)
    if n > cfg["shrinkAfterChars"]:
        return max(cfg["size"] * cfg["shrinkAfterChars"] / n, cfg["minSize"])
    return cfg["size"]


# --- Geometría ---


def _line_arrays(geoms) -> list[np.ndarray]:
    out = []
    for g in geoms:
        if g is None or g.is_empty:
            continue
        parts = getattr(g, "geoms", [g])
        for p in parts:
            coords = np.asarray(p.coords)
            if len(coords) >= 2:
                out.append(coords[:, :2])
    return out


def _poly_arrays(geoms) -> list[np.ndarray]:
    out = []
    for g in geoms:
        if g is None or g.is_empty:
            continue
        for p in getattr(g, "geoms", [g]):
            if p.geom_type == "Polygon":
                out.append(np.asarray(p.exterior.coords)[:, :2])
    return out


def _holes(geoms) -> list[np.ndarray]:
    out = []
    for g in geoms:
        if g is None or g.is_empty:
            continue
        for p in getattr(g, "geoms", [g]):
            if p.geom_type == "Polygon":
                out.extend(np.asarray(r.coords)[:, :2] for r in p.interiors)
    return out


def _gradient(ax, color: str, y0: float, y1: float, x0: float, x1: float, fade_up: bool):
    rgb = mcolors.to_rgb(color)
    cols = np.zeros((256, 4))
    cols[:, :3] = rgb
    cols[:, 3] = np.linspace(1, 0, 256) if fade_up else np.linspace(0, 1, 256)
    grad = np.linspace(0, 1, 256).reshape(-1, 1)
    ax.imshow(
        np.hstack((grad, grad)),
        extent=[x0, x1, y0, y1],
        aspect="auto",
        cmap=mcolors.ListedColormap(cols),
        zorder=10,
        origin="lower",
        interpolation="bilinear",
    )


def render(
    spec: PosterSpec,
    provider: MapDataProvider,
    mode: Mode = "print",
    finish: str = "digital",
    out_format: OutFormat = "png",
    dpi: float | None = None,
    watermark: str | None = None,
) -> RenderResult:
    lay = assets.layout()
    fmts = assets.formats()
    fmt = assets.get_format(spec.format_id)
    pal = spec.palette()

    trim_w_cm, trim_h_cm = spec.trim_size_cm()
    trim_w_mm, trim_h_mm = trim_w_cm * 10, trim_h_cm * 10
    bleed_mm = assets.get_finish(finish)["bleedMm"] if mode == "print" else 0.0
    canvas_w_mm, canvas_h_mm = trim_w_mm + 2 * bleed_mm, trim_h_mm + 2 * bleed_mm

    if dpi is None:
        if mode == "print":
            dpi = float(fmt.get("pngDpi", fmts["printDpi"]))
        else:
            long_px = fmts["previewLongSidePx"][mode]
            dpi = long_px / (max(canvas_w_mm, canvas_h_mm) / MM_PER_IN)
    width_px = round(canvas_w_mm / MM_PER_IN * dpi)
    height_px = round(canvas_h_mm / MM_PER_IN * dpi)

    frame: Frame = compute_frame(spec.center.lat, spec.center.lon, spec.width_meters, trim_w_mm, trim_h_mm, bleed_mm)
    data: MapData = provider.fetch(frame.fetch_bbox)

    # Escala: todo lo "físico" (textos, grosores) es proporcional al lado menor del área de corte.
    min_side_in = min(trim_w_mm, trim_h_mm) / MM_PER_IN
    frac_to_pt = min_side_in * PT_PER_IN
    m_per_mm = spec.width_meters / trim_w_mm

    # +0.001 px evita que Agg trunque 2479.9999 a 2479.
    fig = Figure(figsize=((width_px + 0.001) / dpi, (height_px + 0.001) / dpi), dpi=dpi, facecolor=pal["bg"])
    FigureCanvasAgg(fig)
    ax = fig.add_axes((0.0, 0.0, 1.0, 1.0))
    ax.set_axis_off()
    ax.set_facecolor(pal["bg"])

    # Capa 1: agua y parques
    for gdf, color, z in ((data.water, pal["water"], 0.5), (data.parks, pal["parks"], 0.8)):
        if gdf is None or gdf.empty:
            continue
        proj = gdf.to_crs(frame.crs)
        ax.add_collection(PolyCollection(_poly_arrays(proj.geometry), facecolors=color, edgecolors="none", zorder=z))
        holes = _holes(proj.geometry)
        if holes:
            ax.add_collection(PolyCollection(holes, facecolors=pal["bg"], edgecolors="none", zorder=z + 0.05))

    # Capa 2: calles por jerarquía (las principales encima)
    roads = data.roads.to_crs(frame.crs)
    classes = roads["highway"].map(road_class)
    for i, cls in enumerate(ROAD_CLASSES):
        geoms = roads.geometry[classes == cls]
        if geoms.empty:
            continue
        style = lay["roads"][cls]
        ax.add_collection(
            LineCollection(
                _line_arrays(geoms),
                colors=pal[style["color"]],
                linewidths=style["width"] * frac_to_pt,
                capstyle="round",
                joinstyle="round",
                zorder=2 + i * 0.01,
            )
        )

    ax.set_xlim(frame.xmin, frame.xmax)
    ax.set_ylim(frame.ymin, frame.ymax)
    ax.set_aspect("auto")

    # Capa 3: degradados superior e inferior (sobre el área de corte, extendidos al sangrado)
    bleed_m = bleed_mm * m_per_mm
    trim_h_m = trim_h_mm * m_per_mm
    trim_bottom = frame.ymin + bleed_m
    trim_top = frame.ymax - bleed_m
    gh = lay["gradient"]["height"] * trim_h_m
    _gradient(ax, pal["gradient_color"], frame.ymin, trim_bottom + gh, frame.xmin, frame.xmax, fade_up=True)
    _gradient(ax, pal["gradient_color"], trim_top - gh, frame.ymax, frame.xmin, frame.xmax, fade_up=False)
    ax.set_xlim(frame.xmin, frame.xmax)
    ax.set_ylim(frame.ymin, frame.ymax)

    # Capa 4: marcadores
    to_local = frame.to_local()
    marker_size_m = lay["marker"]["size"] * min(trim_w_mm, trim_h_mm) * m_per_mm
    shapes = assets.markers()["shapes"]
    for mk in spec.markers:
        mx, my = to_local.transform(mk.lon, mk.lat)
        poly = np.asarray(shapes[mk.shape], dtype=float) * marker_size_m + (mx, my)
        ax.add_collection(
            PolyCollection(
                [poly],
                facecolors=mk.color or pal["text"],
                edgecolors=pal["bg"],
                linewidths=0.004 * frac_to_pt,
                zorder=9,
            )
        )

    # Capa 5: tipografía (coordenadas relativas al área de corte)
    fonts = load_fonts(spec.font_family)

    def fx(x: float) -> float:
        return (bleed_mm + x * trim_w_mm) / canvas_w_mm

    def fy(y: float) -> float:
        return (bleed_mm + y * trim_h_mm) / canvas_h_mm

    def font(weight: str, frac: float) -> FontProperties:
        return FontProperties(fname=fonts[weight], size=frac * frac_to_pt)

    t = spec.texts
    color = pal["text"]
    fig.text(
        fx(0.5),
        fy(lay["title"]["y"]),
        title_text(t.title),
        ha="center",
        color=color,
        fontproperties=font("bold", title_size_frac(t.title)),
        zorder=11,
    )
    d = lay["divider"]
    fig.add_artist(
        Line2D(
            [fx(d["x0"]), fx(d["x1"])],
            [fy(d["y"]), fy(d["y"])],
            color=color,
            linewidth=d["width"] * frac_to_pt,
            zorder=11,
        )
    )
    if t.subtitle:
        fig.text(
            fx(0.5),
            fy(lay["subtitle"]["y"]),
            t.subtitle.upper(),
            ha="center",
            color=color,
            fontproperties=font("light", lay["subtitle"]["size"]),
            zorder=11,
        )
    if t.show_coords:
        coords = t.coords or format_coords(spec.center.lat, spec.center.lon)
        fig.text(
            fx(0.5),
            fy(lay["coords"]["y"]),
            coords,
            ha="center",
            color=color,
            alpha=lay["coords"]["alpha"],
            fontproperties=font("regular", lay["coords"]["size"]),
            zorder=11,
        )
    if t.dedication:
        fig.text(
            fx(0.5),
            fy(lay["dedication"]["y"]),
            t.dedication,
            ha="center",
            color=color,
            alpha=lay["dedication"]["alpha"],
            fontproperties=font("light", lay["dedication"]["size"]),
            zorder=11,
        )
    a = lay["attribution"]
    fig.text(
        fx(a["x"]),
        fy(a["y"]),
        a["text"],
        ha="right",
        va="bottom",
        color=color,
        alpha=a["alpha"],
        fontproperties=font("light", a["size"]),
        zorder=11,
    )

    if watermark:
        wm_font = FontProperties(fname=fonts["bold"], size=0.05 * frac_to_pt)
        for yy in np.linspace(0.12, 0.92, 5):
            fig.text(
                0.5,
                yy,
                watermark,
                ha="center",
                va="center",
                rotation=30,
                color=color,
                alpha=0.13,
                fontproperties=wm_font,
                zorder=12,
            )

    buf = io.BytesIO()
    with matplotlib.rc_context({"pdf.fonttype": 42, "path.simplify": True}):
        fig.savefig(buf, format=out_format, dpi=dpi, facecolor=pal["bg"])
    fig.clear()
    ctype = "application/pdf" if out_format == "pdf" else "image/png"
    return RenderResult(buf.getvalue(), ctype, width_px, height_px, dpi, bleed_mm)
