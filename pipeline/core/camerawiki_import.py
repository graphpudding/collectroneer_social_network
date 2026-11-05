"""`catalog import-camerawiki DUMP`: builds categories/film_cameras/catalog.json from the dump.

Also writes the ID registry, review/ files, the gaps list (gaps.csv: one row per model,
a status per field; gaps_raw.csv: source texts still to normalise) and REPORT.md.
"""

import csv
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from core import user_edits
from core.adapters.camerawiki_dump import CATEGORY, GAP_FIELDS, Converted, Dump, compact, convert
from core.config import CATEGORIES_DIR
from core.registry import IdConflict, Registry

MERGE_DICTS = ("attributes", "external_ids", "field_sources", "labels")
MERGE_LISTS = ("source_urls", "attribution", "aliases")


def _display(rec: dict[str, Any]) -> str:
    return f"{rec['maker']} {rec['name']}"


def overlay(base: dict[str, Any], curated: dict[str, Any]) -> dict[str, Any]:
    """A hand-checked record over a converted one: curated values win, gaps are filled."""
    out = dict(base)
    for k, v in curated.items():
        if k == "id" or v in (None, "", [], {}):
            continue
        if k in MERGE_DICTS:
            out[k] = {**base.get(k, {}), **v}
        elif k in MERGE_LISTS:
            out[k] = list(dict.fromkeys([*v, *base.get(k, [])]))
        else:
            out[k] = v
    if base.get("data_license") and base["data_license"] != curated.get("data_license"):
        out["data_license"] = f"{curated['data_license']}; {base['data_license']}"
    out["match_confidence"] = curated.get("match_confidence", "high")
    return out


def _llm_fields() -> dict[str, dict[str, Any]]:
    """Latest quote-checked LLM fields per camera-wiki card, if the extraction has run."""
    from core.llm_extract import MODEL, PROMPT_VERSION, load_cache

    current = f":v{PROMPT_VERSION}:{MODEL}"
    return {e["card_id"]: e["fields"] for k, e in load_cache().items() if k.endswith(current)}


def _write_csv(path: Path, header: list[str], rows: list[list[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def build(dump_path: Path, sample_path: Path | None) -> dict[str, Any]:
    out_dir = CATEGORIES_DIR / CATEGORY
    run = f"camerawiki-dump-{datetime.now(UTC):%Y%m%d}"
    registry_path = out_dir / "id_registry.csv"
    registry = Registry.load(CATEGORY, registry_path)

    sample = (
        json.loads(sample_path.read_text()) if sample_path else {"records": [], "relations": []}
    )
    curated = {compact(_display(r)): r for r in sample["records"]}
    for r in sample["records"]:  # their provisional IDs become the first registry entries
        if r["id"] not in registry.entries:
            keys = [f"{k}:{v}" for k, v in r["external_ids"].items() if k == "wikidata"]
            registry.assign(keys, run)
            assert registry.entries[r["id"]].match_keys == keys, "sample IDs must come first"

    dump = Dump(dump_path)
    llm = _llm_fields()
    converted = [convert(card, dump, llm.get(card["id"])) for card in dump.cards()]

    records: list[dict[str, Any]] = []
    gaps: list[Converted] = []
    by_source: dict[str, str] = {}
    excluded, conflicts = [], []
    used_curated = set()
    for c in converted:
        if c.skip_reason:
            excluded.append([c.source_id, c.record["name"], c.skip_reason])
            continue
        rec = c.record
        keys = [f"camerawiki:{c.source_id.split(':', 1)[1]}"]
        cur = curated.get(compact(_display(rec)))
        if cur:
            keys += [f"wikidata:{cur['external_ids']['wikidata']}"]
        try:
            rec_id = registry.assign(keys, run)
        except IdConflict as exc:
            conflicts.append([c.source_id, _display(rec), " ".join(exc.ids)])
            continue
        rec = {"id": rec_id, "status": "active", **rec}
        if cur:
            rec = overlay(rec, cur)
            used_curated.add(cur["id"])
            for f in ("year_start", "year_end", "country", "production_count"):
                if rec.get(f) is not None:
                    c.status[f] = "ok"
            for f in ("camera_type", "film_format", "frame_size", "shutter_type", "focus"):
                if rec["attributes"].get(f):
                    c.status[f] = "ok"
            if rec.get("image_url"):
                c.status["image"] = "ok"
        by_source[c.source_id] = rec_id
        c.record = rec
        records.append(rec)
        gaps.append(c)

    for r in sample["records"]:  # curated models camera-wiki has no page for
        if r["id"] not in used_curated:
            records.append(r)

    # Approved user edits win over every automatic source (pulled with `catalog user-edits pull`).
    edit_counts = user_edits.apply(records, user_edits.load(out_dir / "user_edits.jsonl"), CATEGORY)

    relations = {(r["from_id"], r["to_id"]): r["source"] for r in sample["relations"]}
    for c in gaps:
        rec_id = by_source[c.source_id]
        if c.variant_of in by_source:
            relations[(rec_id, by_source[c.variant_of])] = "camera-wiki base model"
        for v in c.variants:
            if v in by_source and by_source[v] != rec_id:
                relations[(by_source[v], rec_id)] = "camera-wiki variants list"
    relation_rows = [
        {"from_id": a, "relation": "variant_of", "to_id": b, "source": s}
        for (a, b), s in sorted(relations.items())
    ]

    catalog = {
        "about": (
            f"film_cameras from the camera-wiki dump ({dump_path.name}), run {run}. "
            "Hand-checked sample records (Wikidata, Wikipedia, Commons) override camera-wiki "
            "values where both exist."
        ),
        "records": records,
        "relations": relation_rows,
    }
    (out_dir / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1))
    registry.save(registry_path)

    review = out_dir / "review"
    _write_csv(review / "excluded.csv", ["source_id", "name", "reason"], excluded)
    _write_csv(review / "id_conflicts.csv", ["source_id", "name", "registry_ids"], conflicts)
    _write_csv(
        out_dir / "gaps.csv",
        ["id", "maker", "name", "source_url", "missing", *GAP_FIELDS, "country_hint", "check"],
        [
            [
                c.record["id"],
                c.record["maker"],
                c.record["name"],
                c.record["source_urls"][0],
                sum(1 for f in GAP_FIELDS if c.status[f] in ("missing", "raw")),
                *(c.status[f] for f in GAP_FIELDS),
                c.hints.get("country", ""),
                "; ".join(v for k, v in c.hints.items() if k != "country"),
            ]
            for c in gaps
        ],
    )
    _write_csv(
        out_dir / "gaps_raw.csv",
        ["id", "name", "field", "source_text"],
        [
            [c.record["id"], _display(c.record), f, t]
            for c in gaps
            for f, t in c.raw.items()
            if c.status[f] == "raw"
        ],
    )

    stats = {f: Counter(c.status[f] for c in gaps) for f in GAP_FIELDS}
    report = _report(run, dump_path, records, relation_rows, excluded, conflicts, gaps, stats)
    report += (
        f"\n## User edits\n\nReplayed from `user_edits.jsonl`: {edit_counts['edit']} edits, "
        f"{edit_counts['new_model']} new models, {edit_counts['merge']} merges"
        + (f", {edit_counts['missing']} for unknown ids" if edit_counts["missing"] else "")
        + ".\n"
    )
    (out_dir / "REPORT.md").write_text(report)
    return {
        "records": len(records),
        "relations": len(relation_rows),
        "excluded": len(excluded),
        "conflicts": len(conflicts),
        "stats": stats,
    }


def _report(run, dump_path, records, relations, excluded, conflicts, gaps, stats) -> str:
    n = len(gaps)
    dupes = Counter(compact(_display(r)) for r in records)
    lines = [
        f"# film_cameras: camera-wiki import, run {run}",
        "",
        f"Source: `{dump_path.name}`. Records: **{len(records)}**, variant relations: "
        f"{len(relations)}, excluded: {len(excluded)} (`review/excluded.csv`), "
        f"ID conflicts: {len(conflicts)} (`review/id_conflicts.csv`).",
        "",
        "## Fields",
        "",
        "ok = normalised from structured fields; llm = extracted from the article text with a "
        "verified quote; raw = the source has text we could not normalise yet "
        "(`gaps_raw.csv`); missing = nothing in the source.",
        "",
        "| Field | ok | llm | raw | missing | |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for f in GAP_FIELDS:
        s = stats[f]
        filled = s["ok"] + s["llm"]
        lines.append(
            f"| {f} | {s['ok']} | {s['llm']} | {s['raw']} | {s['missing']} "
            f"| {100 * filled // n}% filled |"
        )
    hints = sum(1 for c in gaps if c.status["country"] != "ok" and c.hints.get("country"))
    lines += [
        "",
        f"Country hints (not used as values): {hints} records have a guess from the brand's "
        "nationality or factory timeline, in the `country_hint` column of `gaps.csv`.",
        "",
        "## Same display name",
        "",
        *[f"- {k}: {v}" for k, v in dupes.items() if v > 1],
        "",
    ]
    return "\n".join(lines)
