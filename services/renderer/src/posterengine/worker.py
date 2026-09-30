"""Worker de la cola de render sobre Postgres (tabla render_jobs, creada por las migraciones de la web).

Recoge trabajos con FOR UPDATE SKIP LOCKED, así se pueden lanzar varios workers sin Redis.
Al terminar un trabajo avisa a la web (POST /api/internal/render-complete) para que continúe el pedido.
"""

import json
import logging
import os
import signal
import socket
import time
import traceback

import psycopg
import requests
from psycopg.rows import dict_row

from .jobs import run_job
from .spec import PosterSpec
from .storage import from_env

log = logging.getLogger("posterengine.worker")

CLAIM_SQL = """
UPDATE render_jobs SET status = 'running', started_at = now(), updated_at = now(),
       attempts = attempts + 1, locked_by = %(worker)s
WHERE id = (
    SELECT id FROM render_jobs
    WHERE status = 'queued' AND run_after <= now()
    ORDER BY priority DESC, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, kind, finish, spec, attempts, max_attempts
"""

REQUEUE_STALE_SQL = """
UPDATE render_jobs SET status = 'queued', locked_by = NULL, updated_at = now()
WHERE status = 'running' AND started_at < now() - make_interval(mins => %(minutes)s)
"""


def make_provider():
    if os.environ.get("POSTER_DATA_PROVIDER") == "synthetic":
        from .synthetic import SyntheticProvider

        return SyntheticProvider()
    from .osm_data import OSMnxProvider

    return OSMnxProvider()


def notify_web(job_id: str) -> None:
    url = os.environ.get("WEB_INTERNAL_URL")
    if not url:
        return
    try:
        requests.post(
            f"{url.rstrip('/')}/api/internal/render-complete",
            json={"jobId": job_id},
            headers={"x-internal-secret": os.environ.get("INTERNAL_API_SECRET", "")},
            timeout=30,
        ).raise_for_status()
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo avisar a la web del trabajo %s: %s", job_id, e)


def process_one(conn, provider, storage, worker_id: str, watermark: str) -> bool:
    with conn.transaction():
        job = conn.execute(CLAIM_SQL, {"worker": worker_id}).fetchone()
    if not job:
        return False
    job_id = str(job["id"])
    log.info("trabajo %s (%s, %s) intento %s", job_id, job["kind"], job["finish"], job["attempts"])
    t0 = time.time()
    try:
        spec = PosterSpec.model_validate(job["spec"])
        outputs = run_job(job_id, job["kind"], job["finish"], spec, provider, storage, watermark)
        conn.execute(
            "UPDATE render_jobs SET status='done', output=%s, error=NULL, finished_at=now(), updated_at=now(),"
            " duration_ms=%s WHERE id=%s",
            (json.dumps([o.as_json() for o in outputs]), int((time.time() - t0) * 1000), job_id),
        )
        conn.commit()
        log.info("trabajo %s terminado en %.1fs", job_id, time.time() - t0)
    except Exception as e:  # noqa: BLE001
        err = f"{type(e).__name__}: {e}\n{traceback.format_exc(limit=5)}"
        final = job["attempts"] >= job["max_attempts"]
        conn.execute(
            "UPDATE render_jobs SET status=%s, error=%s, updated_at=now(), locked_by=NULL,"
            " run_after = now() + make_interval(secs => %s),"
            " finished_at = CASE WHEN %s THEN now() ELSE NULL END WHERE id=%s",
            ("failed" if final else "queued", err[:4000], 30 * job["attempts"], final, job_id),
        )
        conn.commit()
        log.error("trabajo %s falló (%s): %s", job_id, "definitivo" if final else "se reintentará", e)
        if not final:
            return True
    notify_web(job_id)
    return True


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    logging.getLogger("fontTools").setLevel(logging.WARNING)
    dsn = os.environ["DATABASE_URL"]
    worker_id = f"{socket.gethostname()}-{os.getpid()}"
    watermark = os.environ.get("WATERMARK_TEXT", "VISTA PREVIA")
    poll = float(os.environ.get("POLL_SECONDS", "2"))
    provider, storage = make_provider(), from_env()
    stop = False

    def _stop(*_):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    log.info("worker %s iniciado", worker_id)
    last_stale_check = 0.0
    while not stop:
        try:
            with psycopg.connect(dsn, row_factory=dict_row) as conn:
                while not stop:
                    if time.time() - last_stale_check > 60:
                        conn.execute(REQUEUE_STALE_SQL, {"minutes": 20})
                        conn.commit()
                        last_stale_check = time.time()
                    if not process_one(conn, provider, storage, worker_id, watermark):
                        time.sleep(poll)
        except psycopg.OperationalError as e:
            log.error("Error de base de datos: %s; reintento en 5 s", e)
            time.sleep(5)
    log.info("worker detenido")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
