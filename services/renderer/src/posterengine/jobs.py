"""Qué archivos produce cada tipo de trabajo de render."""

from dataclasses import dataclass

from . import assets
from .osm_data import MapDataProvider
from .render import render
from .spec import PosterSpec


@dataclass
class OutputFile:
    key: str
    content_type: str
    width: int
    height: int
    bytes: int
    role: str  # preview | proof | print_png | print_pdf

    def as_json(self) -> dict:
        return {
            "key": self.key,
            "contentType": self.content_type,
            "width": self.width,
            "height": self.height,
            "bytes": self.bytes,
            "role": self.role,
        }


def run_job(
    job_id: str, kind: str, finish: str, spec: PosterSpec, provider: MapDataProvider, storage, watermark: str
) -> list[OutputFile]:
    outputs: list[OutputFile] = []

    def emit(role: str, key: str, mode: str, out_format: str, wm: str | None):
        res = render(spec, provider, mode=mode, finish=finish, out_format=out_format, watermark=wm)
        storage.put(key, res.data, res.content_type)
        outputs.append(OutputFile(key, res.content_type, res.width_px, res.height_px, len(res.data), role))

    if kind in ("preview", "proof"):
        # Las miniaturas de catálogo son de baja resolución; la marca de agua sólo va en la prueba exacta.
        emit(kind, f"{kind}s/{job_id}.png", kind, "png", watermark if kind == "proof" else None)
    elif kind == "print":
        fmt = assets.get_format(spec.format_id)
        physical = assets.get_finish(finish)["physical"]
        if physical:
            # Un único archivo de imprenta con sangrado: PNG hasta 50×70, PDF vectorial en 70×100.
            if fmt["pdf"]:
                emit("print_pdf", f"prints/{job_id}.pdf", "print", "pdf", None)
            else:
                emit("print_png", f"prints/{job_id}.png", "print", "png", None)
        else:
            # Descarga digital: PNG de alta resolución + PDF vectorial (sin sangrado).
            emit("print_png", f"prints/{job_id}.png", "print", "png", None)
            emit("print_pdf", f"prints/{job_id}.pdf", "print", "pdf", None)
    else:
        raise ValueError(f"Tipo de trabajo desconocido: {kind}")
    return outputs
