"""El encuadre Python (tmerc) debe coincidir con el de la web (Web Mercator, apps/web/lib/frame.ts).

Los casos esperados están en packages/themes/frame-fixtures.json y los comprueban ambos lenguajes.
"""

import json

import pytest

from posterengine import assets
from posterengine.frame import compute_frame

FIXTURES = json.loads((assets.assets_dir() / "frame-fixtures.json").read_text())


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_trim_bbox_matches_fixture(case):
    f = compute_frame(case["lat"], case["lon"], case["widthMeters"], case["trimW"], case["trimH"], 0, margin=0)
    w, s, e, n = f.fetch_bbox
    ew, es, ee, en = case["bbox"]
    tol_x = (ee - ew) * 0.005
    tol_y = (en - es) * 0.005
    assert w == pytest.approx(ew, abs=tol_x) and e == pytest.approx(ee, abs=tol_x)
    assert s == pytest.approx(es, abs=tol_y) and n == pytest.approx(en, abs=tol_y)
