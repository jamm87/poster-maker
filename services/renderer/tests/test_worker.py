"""Integración del worker con Postgres (se omite si no hay TEST_DATABASE_URL).

Aplica las migraciones SQL de la web (apps/web/drizzle) en una BD de pruebas y procesa trabajos reales.
"""

import json
import os
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
from psycopg.rows import dict_row  # noqa: E402

from posterengine import worker  # noqa: E402
from posterengine.storage import LocalStorage  # noqa: E402
from posterengine.synthetic import SyntheticProvider  # noqa: E402

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL no configurada")
MIGRATIONS = Path(__file__).resolve().parents[3] / "apps" / "web" / "drizzle"

SPEC = {
    "center": {"lat": 40.4168, "lon": -3.7038},
    "widthMeters": 5000,
    "formatId": "a4",
    "themeId": "noir",
    "texts": {"title": "Madrid"},
}


@pytest.fixture
def conn():
    with psycopg.connect(DSN, row_factory=dict_row, autocommit=True) as c:
        c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        for sql_file in sorted(MIGRATIONS.glob("*.sql")):
            for stmt in sql_file.read_text().split("--> statement-breakpoint"):
                if stmt.strip():
                    c.execute(stmt)
    with psycopg.connect(DSN, row_factory=dict_row) as c:
        yield c


def insert_job(conn, kind="proof", finish="digital", spec=None):
    row = conn.execute(
        "INSERT INTO render_jobs (kind, finish, spec, spec_hash) VALUES (%s, %s, %s, 'h') RETURNING id",
        (kind, finish, json.dumps(spec or SPEC)),
    ).fetchone()
    conn.commit()
    return str(row["id"])


def test_processes_proof_job(conn, tmp_path, monkeypatch):
    notified = []
    monkeypatch.setattr(worker, "notify_web", notified.append)
    job_id = insert_job(conn)
    assert worker.process_one(conn, SyntheticProvider(), LocalStorage(str(tmp_path)), "test", "WM")
    job = conn.execute("SELECT * FROM render_jobs WHERE id=%s", (job_id,)).fetchone()
    assert job["status"] == "done" and job["attempts"] == 1
    assert job["output"][0]["role"] == "proof"
    assert (tmp_path / job["output"][0]["key"]).exists()
    assert notified == [job_id]
    assert not worker.process_one(conn, SyntheticProvider(), LocalStorage(str(tmp_path)), "test", "WM")


def test_priority_order(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "notify_web", lambda _id: None)
    low = insert_job(conn, "preview")
    high = insert_job(conn, "print")
    conn.execute("UPDATE render_jobs SET priority=10 WHERE id=%s", (high,))
    conn.commit()
    monkeypatch.setattr("posterengine.jobs.render", _fast_render())
    worker.process_one(conn, SyntheticProvider(), LocalStorage(str(tmp_path)), "t", "WM")
    first = conn.execute("SELECT id FROM render_jobs WHERE status='done'").fetchall()
    assert [str(r["id"]) for r in first] == [high]
    assert low


def test_failure_retries_then_fails(conn, tmp_path, monkeypatch):
    notified = []
    monkeypatch.setattr(worker, "notify_web", notified.append)
    job_id = insert_job(conn, spec={**SPEC, "themeId": "no-existe"})
    conn.execute("UPDATE render_jobs SET max_attempts=2 WHERE id=%s", (job_id,))
    conn.commit()
    worker.process_one(conn, SyntheticProvider(), LocalStorage(str(tmp_path)), "t", "WM")
    job = conn.execute("SELECT * FROM render_jobs WHERE id=%s", (job_id,)).fetchone()
    assert job["status"] == "queued" and "Tema desconocido" in job["error"]
    conn.execute("UPDATE render_jobs SET run_after=now() WHERE id=%s", (job_id,))
    conn.commit()
    worker.process_one(conn, SyntheticProvider(), LocalStorage(str(tmp_path)), "t", "WM")
    job = conn.execute("SELECT * FROM render_jobs WHERE id=%s", (job_id,)).fetchone()
    assert job["status"] == "failed" and job["finished_at"] is not None
    assert notified == [job_id]  # sólo se avisa del fallo definitivo


def _fast_render():
    from posterengine.render import render

    return lambda *a, **k: render(*a, **{**k, "dpi": 20})
