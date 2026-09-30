"""Motor de render de pósters de mapas.

Derivado de https://github.com/originalankur/maptoposter (MIT, © 2026 Ankur Gupta).
Ver THIRD_PARTY_LICENSE_maptoposter.txt.
"""

from .render import RenderResult, render
from .spec import PosterSpec

__all__ = ["PosterSpec", "RenderResult", "render"]
