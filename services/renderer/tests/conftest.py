import pytest

from posterengine.spec import PosterSpec
from posterengine.synthetic import SyntheticProvider


def make_spec(**over) -> PosterSpec:
    data = {
        "center": {"lat": 40.4168, "lon": -3.7038},
        "widthMeters": 6000,
        "formatId": "30x40",
        "themeId": "noir",
        "texts": {"title": "Madrid", "subtitle": "España"},
    }
    data.update(over)
    return PosterSpec.model_validate(data)


@pytest.fixture
def provider():
    return SyntheticProvider()


@pytest.fixture
def spec():
    return make_spec()
