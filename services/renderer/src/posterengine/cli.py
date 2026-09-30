"""CLI de desarrollo: renderiza un PosterSpec JSON a un archivo.

uv run posterengine spec.json -o out.png --mode proof [--synthetic]
"""

import argparse
import json
import logging
import sys

from .render import render
from .spec import PosterSpec


def make_provider(synthetic: bool):
    if synthetic:
        from .synthetic import SyntheticProvider

        return SyntheticProvider()
    from .osm_data import OSMnxProvider

    return OSMnxProvider()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Renderiza un póster desde un PosterSpec JSON")
    p.add_argument("spec", help="ruta al JSON (o '-' para stdin)")
    p.add_argument("-o", "--output", required=True)
    p.add_argument("--mode", choices=["preview", "proof", "print"], default="proof")
    p.add_argument("--finish", default="digital")
    p.add_argument("--format", choices=["png", "pdf"], default=None)
    p.add_argument("--dpi", type=float, default=None)
    p.add_argument("--watermark", default=None)
    p.add_argument("--synthetic", action="store_true", help="usar datos sintéticos (sin red)")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("fontTools").setLevel(logging.WARNING)

    raw = sys.stdin.read() if args.spec == "-" else open(args.spec, encoding="utf-8").read()
    spec = PosterSpec.model_validate(json.loads(raw))
    out_format = args.format or ("pdf" if args.output.lower().endswith(".pdf") else "png")
    res = render(
        spec,
        make_provider(args.synthetic),
        mode=args.mode,
        finish=args.finish,
        out_format=out_format,
        dpi=args.dpi,
        watermark=args.watermark,
    )
    with open(args.output, "wb") as f:
        f.write(res.data)
    print(f"{args.output}: {res.width_px}x{res.height_px}px @ {res.dpi:.1f} dpi, sangrado {res.bleed_mm} mm")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
