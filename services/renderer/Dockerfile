# Worker de render (Python). Contexto de build: raíz del repositorio.
#   docker build -f services/renderer/Dockerfile -t poster-worker .
FROM python:3.11-slim
RUN pip install --no-cache-dir uv==0.8.17
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    POSTER_ASSETS_DIR=/app/packages/themes \
    OSM_CACHE_DIR=/cache/osm FONT_CACHE_DIR=/cache/fonts STORAGE_LOCAL_DIR=/data/files
WORKDIR /app/services/renderer
COPY services/renderer/pyproject.toml services/renderer/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY packages/themes /app/packages/themes
COPY services/renderer ./
RUN uv sync --frozen --no-dev \
 && useradd --uid 1001 --create-home worker \
 && mkdir -p /cache /data/files && chown -R worker /cache /data
USER worker
CMD ["/app/services/renderer/.venv/bin/posterengine-worker"]
