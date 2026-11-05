"""Approved user edits (docs/SPEC.md section 6) as a pipeline source.

`catalog user-edits pull` copies approved edits from the product database into
categories/<category>/user_edits.jsonl and records new and merged ids in the ID registry, so the
next build neither reuses those numbers nor drops the edits. The build then replays the file over
the assembled records: an approved edit wins over automatic sources, and every value it sets is
marked user_edit:<edit id> in field_sources.
"""

import json
import re
from pathlib import Path
from typing import Any

import psycopg

from core.registry import Entry, Registry

USER_DATA_LICENSE = "CC BY-SA 4.0"
USER_ATTRIBUTION = "Collectors Note contributors, CC BY-SA 4.0"
TOP_FIELDS = {"maker", "name", "year_start", "year_end", "country", "production_count"}


def pull(conn: psycopg.Connection, category: str, out: Path, registry: Registry) -> int:
    rows = conn.execute(
        """select id::text, kind, catalog_id, changes, source, note, result_catalog_id, reviewed_at
           from catalog_edits where status = 'approved' and category = %s
           order by reviewed_at, id""",
        (category,),
    ).fetchall()
    edits = [
        {
            "id": r[0], "kind": r[1], "catalog_id": r[2], "changes": r[3], "source": r[4],
            "note": r[5], "result_catalog_id": r[6], "reviewed_at": r[7].isoformat(),
        }
        for r in rows
    ]  # fmt: skip
    out.write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in edits))
    for e in edits:
        if e["kind"] == "new_model" and e["result_catalog_id"] not in registry.entries:
            registry.entries[e["result_catalog_id"]] = Entry(
                id=e["result_catalog_id"], match_keys=[f"user_edit:{e['id']}"]
            )
        if e["kind"] == "merge" and e["catalog_id"] in registry.entries:
            entry = registry.entries[e["catalog_id"]]
            entry.status, entry.merged_into = "merged", e["changes"]["into"]
    return len(edits)


def load(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _is_url(s: str) -> bool:
    return bool(re.fullmatch(r"https?://\S+", s))


def _value(path: str, value: Any, edit: dict[str, Any]) -> Any:
    if path != "production_count":
        return value
    url = edit["source"] if _is_url(edit["source"]) else None
    return {**value, "source": {"url": url, "quote": edit["note"] if url else edit["source"]}}


def _mark(record: dict[str, Any], edit: dict[str, Any], paths: list[str]) -> None:
    record.setdefault("field_sources", {}).update({p: f"user_edit:{edit['id']}" for p in paths})
    if _is_url(edit["source"]) and edit["source"] not in record.setdefault("source_urls", []):
        record["source_urls"].append(edit["source"])
    if USER_ATTRIBUTION not in record.setdefault("attribution", []):
        record["attribution"].append(USER_ATTRIBUTION)


def apply(
    records: list[dict[str, Any]], edits: list[dict[str, Any]], category: str
) -> dict[str, int]:
    """Replays edits in review order; returns counts by kind (and 'missing' for unknown ids)."""
    by_id = {r["id"]: r for r in records}
    counts = {"edit": 0, "new_model": 0, "merge": 0, "missing": 0}
    for e in edits:
        if e["kind"] == "new_model":
            rid = e["result_catalog_id"]
            record = by_id.get(rid)
            if record is None:
                record = {
                    "id": rid,
                    "status": "active",
                    "category": category,
                    "attributes": {},
                    "data_license": USER_DATA_LICENSE,
                    "match_confidence": "user",
                }
                records.append(record)
                by_id[rid] = record
            _set_all(record, e)
            record["labels"] = {"en": f"{record['maker']} {record['name']}"}
            counts["new_model"] += 1
            continue
        record = by_id.get(e["catalog_id"])
        if record is None:
            counts["missing"] += 1
            continue
        if e["kind"] == "merge":
            record["status"], record["merged_into"] = "merged", e["changes"]["into"]
        else:
            _set_all(record, e)
        counts[e["kind"]] += 1
    return counts


def _set_all(record: dict[str, Any], edit: dict[str, Any]) -> None:
    for path, value in edit["changes"].items():
        if path == "aliases":
            aliases = record.setdefault("aliases", [])
            if value not in aliases:
                aliases.append(value)
        elif path.startswith("attributes."):
            record.setdefault("attributes", {})[path.split(".", 1)[1]] = value
        elif path in TOP_FIELDS:
            record[path] = _value(path, value, edit)
    _mark(record, edit, list(edit["changes"]))
