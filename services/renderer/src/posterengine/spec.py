"""PosterSpec: descripción completa y serializable de un póster (compartida con la web)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from . import assets

HEX = r"^#[0-9A-Fa-f]{6}$"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Center(_Model):
    lat: float = Field(ge=-85, le=85)
    lon: float = Field(ge=-180, le=180)


class Texts(_Model):
    title: str = Field(max_length=40)
    subtitle: str = Field(default="", max_length=60)
    coords: str | None = Field(default=None, max_length=60, description="None = coordenadas automáticas")
    show_coords: bool = Field(default=True, alias="showCoords")
    dedication: str = Field(default="", max_length=80)


class Marker(_Model):
    lat: float = Field(ge=-85, le=85)
    lon: float = Field(ge=-180, le=180)
    shape: Literal["pin", "heart", "star"] = "heart"
    color: str | None = Field(default=None, pattern=HEX)


class Colors(_Model):
    """Sobrescritura parcial de colores del tema."""

    bg: str | None = Field(default=None, pattern=HEX)
    text: str | None = Field(default=None, pattern=HEX)
    gradient_color: str | None = Field(default=None, pattern=HEX)
    water: str | None = Field(default=None, pattern=HEX)
    parks: str | None = Field(default=None, pattern=HEX)
    road_motorway: str | None = Field(default=None, pattern=HEX)
    road_primary: str | None = Field(default=None, pattern=HEX)
    road_secondary: str | None = Field(default=None, pattern=HEX)
    road_tertiary: str | None = Field(default=None, pattern=HEX)
    road_residential: str | None = Field(default=None, pattern=HEX)
    road_default: str | None = Field(default=None, pattern=HEX)


class PosterSpec(_Model):
    version: Literal[1] = 1
    center: Center
    width_meters: float = Field(alias="widthMeters", ge=500, le=60000)
    format_id: str = Field(alias="formatId")
    orientation: Literal["portrait", "landscape"] = "portrait"
    theme_id: str = Field(alias="themeId")
    colors: Colors = Field(default_factory=Colors)
    font_family: str = Field(default="Roboto", alias="fontFamily")
    texts: Texts
    markers: list[Marker] = Field(default_factory=list, max_length=10)

    @field_validator("format_id")
    @classmethod
    def _known_format(cls, v: str) -> str:
        try:
            assets.get_format(v)
        except KeyError as e:
            raise ValueError(str(e)) from e
        return v

    @field_validator("theme_id")
    @classmethod
    def _known_theme(cls, v: str) -> str:
        if v not in assets.themes():
            raise ValueError(f"Tema desconocido: {v}")
        return v

    @field_validator("font_family")
    @classmethod
    def _known_font(cls, v: str) -> str:
        families = {f["family"] for f in assets.fonts_catalog()["fonts"]}
        if v not in families:
            raise ValueError(f"Tipografía no disponible: {v}")
        return v

    @model_validator(mode="after")
    def _title_not_blank(self) -> "PosterSpec":
        if not self.texts.title.strip():
            raise ValueError("El título no puede estar vacío")
        return self

    def palette(self) -> dict[str, str]:
        base = assets.themes()[self.theme_id]
        pal = {k: base[k] for k in assets.THEME_KEYS}
        pal.update(self.colors.model_dump(exclude_none=True))
        return pal

    def trim_size_cm(self) -> tuple[float, float]:
        fmt = assets.get_format(self.format_id)
        w, h = fmt["widthCm"], fmt["heightCm"]
        return (h, w) if self.orientation == "landscape" else (w, h)
