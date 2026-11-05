"""Loads catalog records (the catalog.json shape, docs/SPEC.md section 3) into Postgres.

The pipeline writes only to catalog_* tables; the schema itself lives in db/migrations/.
"""

import json
import os
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

JSON_COLUMNS = ("labels", "production_count", "attributes", "external_ids", "field_sources")
COLUMNS = (
    "id",
    "status",
    "merged_into",
    "category",
    "name",
    "maker",
    "labels",
    "aliases",
    "year_start",
    "year_end",
    "country",
    "production_count",
    "attributes",
    "image_url",
    "image_license",
    "image_author",
    "external_ids",
    "source_urls",
    "field_sources",
    "data_license",
    "attribution",
    "match_confidence",
    "notes",
)
REQUIRED = ("id", "category", "name", "maker", "data_license")
DEFAULTS: dict[str, Any] = {
    "status": "active",
    "labels": {},
    "aliases": [],
    "attributes": {},
    "external_ids": {},
    "source_urls": [],
    "field_sources": {},
    "attribution": [],
}

UPSERT = f"""
insert into catalog_entries ({", ".join(COLUMNS)})
values ({", ".join(f"%({c})s" for c in COLUMNS)})
on conflict (id) do update set
  {", ".join(f"{c} = excluded.{c}" for c in COLUMNS if c != "id")}
"""


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL is not set (see .env.example in the repo root)")
    return url


def _row(record: dict[str, Any]) -> dict[str, Any]:
    missing = [c for c in REQUIRED if not record.get(c)]
    if missing:
        raise ValueError(f"{record.get('id', '?')}: missing {', '.join(missing)}")
    unknown = set(record) - set(COLUMNS)
    if unknown:
        raise ValueError(f"{record['id']}: unknown fields {', '.join(sorted(unknown))}")
    row = {c: record.get(c, DEFAULTS.get(c)) for c in COLUMNS}
    for c in JSON_COLUMNS:
        if row[c] is not None:
            row[c] = Jsonb(row[c])
    return row


def load_catalog(path: Path, conn: psycopg.Connection) -> tuple[int, int]:
    """Upserts records and replaces the outgoing relations of every loaded record.

    Returns (records, relations). Runs in one transaction: a bad record loads nothing.
    """
    data = json.loads(path.read_text())
    records = data["records"]
    relations = data.get("relations", [])
    rows = [_row(r) for r in records]
    ids = [r["id"] for r in rows]

    with conn.transaction(), conn.cursor() as cur:
        # Merged records point at others, so insert targets first.
        cur.executemany(UPSERT, sorted(rows, key=lambda r: r["merged_into"] is not None))
        cur.execute("delete from catalog_relations where from_id = any(%s)", (ids,))
        cur.executemany(
            "insert into catalog_relations (from_id, relation, to_id, source)"
            " values (%(from_id)s, %(relation)s, %(to_id)s, %(source)s)",
            [{"source": None, **rel} for rel in relations],
        )
    return len(rows), len(relations)
