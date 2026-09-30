import io

import pytest
from PIL import Image

from posterengine import assets
from posterengine.jobs import run_job
from posterengine.render import format_coords, is_latin_script, render, road_class, title_size_frac, title_text
from posterengine.storage import LocalStorage
from tests.conftest import make_spec

MM_PER_IN = 25.4


def expected_px(cm: float, bleed_mm: float, dpi: float) -> int:
    return round((cm * 10 + 2 * bleed_mm) / MM_PER_IN * dpi)


@pytest.mark.parametrize("fmt", [f["id"] for f in assets.formats()["formats"] if not f["pdf"]])
@pytest.mark.parametrize("orientation", ["portrait", "landscape"])
def test_print_png_exact_pixels_with_bleed(provider, fmt, orientation):
    if fmt not in ("a4", "30x40") and orientation == "landscape":
        pytest.skip("basta con dos formatos en horizontal")
    spec = make_spec(formatId=fmt, orientation=orientation)
    res = render(spec, provider, mode="print", finish="paper", dpi=60)  # dpi bajo para ir rápido
    w_cm, h_cm = spec.trim_size_cm()
    assert (res.width_px, res.height_px) == (expected_px(w_cm, 4, 60), expected_px(h_cm, 4, 60))
    img = Image.open(io.BytesIO(res.data))
    assert img.size == (res.width_px, res.height_px)


def test_print_default_dpi_is_300_for_a4(provider):
    res = render(make_spec(formatId="a4"), provider, mode="print", finish="digital")
    assert (res.width_px, res.height_px) == (2480, 3508)  # A4 a 300 DPI
    assert res.bleed_mm == 0
    assert Image.open(io.BytesIO(res.data)).size == (2480, 3508)


def test_preview_long_side(provider, spec):
    res = render(spec, provider, mode="proof", watermark="VISTA PREVIA")
    assert max(res.width_px, res.height_px) == assets.formats()["previewLongSidePx"]["proof"]
    assert res.bleed_mm == 0  # el sangrado sólo aplica a impresión


def test_pdf_output(provider, spec):
    res = render(spec, provider, mode="print", out_format="pdf")
    assert res.data.startswith(b"%PDF")
    assert res.content_type == "application/pdf"


def test_markers_and_custom_colors_render(provider):
    spec = make_spec(
        colors={"bg": "#FF0000", "gradient_color": "#FF0000"},
        markers=[{"lat": 40.4168, "lon": -3.7038, "shape": "heart", "color": "#00FF00"}],
        texts={"title": "Madrid", "dedication": "Para ti", "showCoords": False},
    )
    res = render(spec, provider, mode="preview")
    img = Image.open(io.BytesIO(res.data)).convert("RGB")
    r, g, b = img.getpixel((2, 2))
    assert r > 245 and g < 10 and b < 10  # fondo personalizado
    cx, cy = img.size[0] // 2, img.size[1] // 2
    greens = [img.getpixel((cx + dx, cy + dy)) for dx in range(-8, 9) for dy in range(-8, 9)]
    assert any(g[1] > 200 and g[0] < 60 for g in greens), "el marcador debe dibujarse en el centro"


def test_fetch_bbox_covers_frame(provider, spec):
    render(spec, provider, mode="preview")
    w, s, e, n = provider.calls[-1]
    assert w < spec.center.lon < e and s < spec.center.lat < n
    # 6 km de ancho + 10 % de margen a 40° N ≈ 0.077° de longitud
    assert 0.07 < e - w < 0.09


def test_helpers():
    assert road_class(["motorway_link", "primary"]) == "motorway"
    assert road_class("living_street") == "residential"
    assert road_class("footway") == "default"
    assert is_latin_script("São Paulo") and not is_latin_script("東京")
    assert title_text("Paris") == "P  A  R  I  S"
    assert title_text("東京") == "東京"
    assert title_size_frac("Barcelona") == assets.layout()["title"]["size"]
    assert title_size_frac("Villanueva de la Cañada") < assets.layout()["title"]["size"]
    assert format_coords(-33.86, 151.2) == "33.8600° S / 151.2000° E"
    assert format_coords(40.4, -3.7) == "40.4000° N / 3.7000° W"


@pytest.mark.parametrize(
    "fmt,finish,roles",
    [
        ("30x40", "digital", ["print_png", "print_pdf"]),
        ("30x40", "framed", ["print_png"]),
        ("70x100", "paper", ["print_pdf"]),
    ],
)
def test_job_outputs(tmp_path, provider, monkeypatch, fmt, finish, roles):
    # Render real a dpi bajo: sustituimos el dpi por formato para acelerar
    import posterengine.jobs as jobs

    orig = jobs.render
    monkeypatch.setattr(jobs, "render", lambda *a, **k: orig(*a, **{**k, "dpi": 30}))
    outs = run_job("abc", "print", finish, make_spec(formatId=fmt), provider, LocalStorage(str(tmp_path)), "WM")
    assert [o.role for o in outs] == roles
    for o in outs:
        assert (tmp_path / o.key).stat().st_size == o.bytes
