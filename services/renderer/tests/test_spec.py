import pytest
from pydantic import ValidationError

from posterengine import assets
from tests.conftest import make_spec


def test_all_17_themes_have_all_keys():
    themes = assets.themes()
    assert len(themes) == 17
    for name, theme in themes.items():
        missing = [k for k in assets.THEME_KEYS if k not in theme]
        assert not missing, f"{name} sin {missing}"


def test_palette_overrides():
    spec = make_spec(colors={"bg": "#123456"})
    pal = spec.palette()
    assert pal["bg"] == "#123456"
    assert pal["text"] == assets.themes()["noir"]["text"]


@pytest.mark.parametrize(
    "over",
    [
        {"themeId": "no-existe"},
        {"formatId": "99x99"},
        {"fontFamily": "Comic Sans MS"},
        {"widthMeters": 10},
        {"colors": {"bg": "red"}},
        {"texts": {"title": "   "}},
        {"unexpected": 1},
    ],
)
def test_invalid_specs_rejected(over):
    with pytest.raises(ValidationError):
        make_spec(**over)


def test_landscape_swaps_trim():
    assert make_spec(orientation="landscape").trim_size_cm() == (40.0, 30.0)
