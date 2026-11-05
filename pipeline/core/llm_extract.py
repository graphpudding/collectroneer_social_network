"""LLM extraction from camera-wiki article text (docs/SPEC.md, sections 7.4 and 9).

Only from the text of the page itself: every value comes with a verbatim quote, and a value
whose quote is not found in the article is dropped. Results are cached in
categories/film_cameras/llm_cache.jsonl by (page, revision, prompt version, model), so a rerun
calls the model only for new revisions or a new prompt.

`catalog llm-extract DUMP --pilot N` runs N articles directly; `--submit` sends the rest as one
Message Batch (half price), `--collect` reads its results into the cache.
"""

import json
import random
import re
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import anthropic

from core.config import CATEGORIES_DIR

MODEL = "claude-haiku-5-5"
# USD per MTok: input, output, cache read (Claude Haiku 5.5, prompts under 100K tokens).
PRICES = (0.10, 0.50, 0.01)
PROMPT_VERSION = 3
SOURCE = "camerawiki"
OUT_DIR = CATEGORIES_DIR / "film_cameras"
CACHE = OUT_DIR / "llm_cache.jsonl"
BATCHES = OUT_DIR / "logs" / "llm_batches.json"

CAMERA_TYPES = [
    "slr", "rangefinder", "tlr", "viewfinder", "point_and_shoot", "instant", "view_camera",
    "press", "folding", "box", "panoramic", "stereo", "subminiature", "single_use", "pinhole",
]  # fmt: skip
SHUTTER_TYPES = ["focal_plane", "focal_plane_cloth", "focal_plane_metal", "leaf", "other"]
METERING = ["none", "built_in", "ttl", "ttl_otf"]
EXPOSURE_MODES = ["manual", "aperture_priority", "shutter_priority", "program"]
FOCUS = ["manual", "autofocus", "zone", "fixed"]

SYSTEM = f"""You extract facts about one film camera model from a camera-wiki.org article \
(MediaWiki markup) for a collectors' catalog.

Rules:
- Use only what the article states. Never fill a field from your own knowledge, and never \
guess. If the article does not say it, leave the field empty: value "" (text), 0 (numbers), \
[] (lists), and quote "".
- Every filled value needs "quote": a short verbatim excerpt of the article (at most about \
200 characters) that states the value. Copy it exactly as written, including the wiki markup \
if it is inside the excerpt; it is checked against the article text.
- If the article covers several models (a family or a series), extract values for the model \
named in the title; set "covers_several_models" to true.
- maker: the brand the camera was sold under: a company or brand name such as "Nikon", \
"Zenit", "GOMZ" - never the camera's own model name. If the article names only one company \
that made or sold it, that company is the maker and manufacturer stays empty. manufacturer: \
the company or factory that made it, only if the article names one different from the maker \
(e.g. maker "Petri", manufacturer "Kuribayashi").
- year_start / year_end: years the model was produced or sold (introduced, discontinued). \
Only an exact year: a decade ("the 1950s") or a vague period is not a year, leave it empty.
- country: country where it was manufactured, only if stated (not the brand's home country).
- production_count: number of units made. basis "stated" for a figure, "estimate" for an \
approximate one ("about", "some"), "range" with min/max for a range.
- camera_type: one of {", ".join(CAMERA_TYPES)}. point_and_shoot = simple or automatic \
compact; single_use = disposable.
- film_format: film type numbers as strings ("135", "120", "127", "620", "110", "126"), \
"aps", "sheet", "plate", or "instant_<system>" (e.g. "instant_sx70").
- frame_size: image size in millimetres as "WxH" (e.g. "24x36", "56x56"); convert cm to mm \
only if the article gives the size in cm.
- lens_mount: the interchangeable lens mount (e.g. "M42", "Nikon F", "Pentax K"). fixed_lens: \
for a non-interchangeable lens, its description (e.g. "Zuiko 33mm f/4.5").
- shutter_type: one of {", ".join(SHUTTER_TYPES)}.
- shutter_speeds: fastest and slowest speed, each written as in the article with "1/" for \
fractions. Examples: "1/5 to 1/400th sec" -> slowest "1/5", fastest "1/400"; "1 second to \
1/500" -> slowest "1", fastest "1/500"; "100, 50, 25, B" (fractions written without "1/") -> \
fastest "1/100", slowest "1/25". bulb true if a B \
setting is mentioned.
- metering: one of {", ".join(METERING)}. built_in = a built-in meter the article says is \
not through the lens (selenium cell, CdS cell on the body); ttl = through the lens. If the \
article mentions a meter but not how it reads, leave metering empty.
- exposure_modes: any of {", ".join(EXPOSURE_MODES)}.
- focus: one of {", ".join(FOCUS)}.
- power: batteries as stated, or "none" for a camera that needs no battery."""


def _field(value_schema: dict[str, Any]) -> dict[str, Any]:
    # No nullable fields (the API limits union types): "not stated" is an empty value and quote.
    return {
        "type": "object",
        "properties": {"value": value_schema, "quote": {"type": "string"}},
        "required": ["value", "quote"],
        "additionalProperties": False,
    }


STRING = {"type": "string"}
INTEGER = {"type": "integer"}
SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "covers_several_models": {"type": "boolean"},
        "maker": _field(STRING),
        "manufacturer": _field(STRING),
        "year_start": _field(INTEGER),
        "year_end": _field(INTEGER),
        "country": _field(STRING),
        "production_count": _field(
            {
                "type": "object",
                "properties": {
                    "value": INTEGER,
                    "min": INTEGER,
                    "max": INTEGER,
                    "basis": {"type": "string", "enum": ["", "stated", "estimate", "range"]},
                },
                "required": ["value", "min", "max", "basis"],
                "additionalProperties": False,
            }
        ),
        "camera_type": _field({"type": "string", "enum": ["", *CAMERA_TYPES]}),
        "film_format": _field({"type": "array", "items": STRING}),
        "frame_size": _field(STRING),
        "lens_mount": _field(STRING),
        "fixed_lens": _field(STRING),
        "shutter_type": _field({"type": "string", "enum": ["", *SHUTTER_TYPES]}),
        "shutter_speeds": _field(
            {
                "type": "object",
                "properties": {
                    "fastest": STRING,
                    "slowest": STRING,
                    "bulb": {"type": "boolean"},
                },
                "required": ["fastest", "slowest", "bulb"],
                "additionalProperties": False,
            }
        ),
        "metering": _field({"type": "string", "enum": ["", *METERING]}),
        "exposure_modes": _field(
            {"type": "array", "items": {"type": "string", "enum": EXPOSURE_MODES}}
        ),
        "focus": _field({"type": "string", "enum": ["", *FOCUS]}),
        "power": _field(STRING),
    },
    "required": [],
    "additionalProperties": False,
}
SCHEMA["required"] = list(SCHEMA["properties"])
FIELDS = [f for f in SCHEMA["properties"] if f != "covers_several_models"]


# --- article text


def clean_wikitext(text: str) -> str:
    """Drops photo templates and comments; facts stay in the markup the model quotes from."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"\{\{\s*Flickr[_ ]image.*?\n?\}\}", "", text, flags=re.S | re.I)
    text = re.sub(r"<gallery.*?</gallery>", "", text, flags=re.S | re.I)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _plain(text: str) -> str:
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"'{2,}|<[^>]+>|&nbsp;", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def quote_found(quote: str, article: str) -> bool:
    q = _plain(quote)
    return len(q) >= 3 and q in _plain(article)


# --- requests and validation


def articles(dump: Path) -> Iterator[dict[str, Any]]:
    conn = sqlite3.connect(f"file:{dump}?mode=ro", uri=True)
    rows = conn.execute(
        """select k.id, k.name, k.source_page_id, k.source_revision, a.wikitext
           from camera_cards k join source_articles a on a.page_id = cast(k.source_page_id as int)
           order by k.id"""
    )
    for card_id, name, page_id, revision, wikitext in rows:
        yield {
            "card_id": card_id,
            "title": name,
            "page_id": str(page_id),
            "revision": str(revision),
            "text": clean_wikitext(wikitext or ""),
        }


def cache_key(a: dict[str, Any]) -> str:
    return f"{SOURCE}:{a['page_id']}:{a['revision']}:v{PROMPT_VERSION}:{MODEL}"


def request_params(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "model": MODEL,
        "max_tokens": 8000,
        "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "messages": [
            {
                "role": "user",
                "content": f"Article title: {a['title']}\n\n<article>\n{a['text']}\n</article>",
            }
        ],
    }


def _empty(v: Any) -> bool:
    if isinstance(v, dict):  # production_count, shutter_speeds: all parts empty
        return all(_empty(x) for k, x in v.items() if k not in ("basis", "bulb"))
    return v in (None, "", 0, [])


def _decade_only(field: str, item: dict[str, Any]) -> bool:
    """A year whose quote only has it as a decade ("the 1950s")."""
    if field not in ("year_start", "year_end"):
        return False
    y = str(item["value"])
    return bool(re.search(rf"{y}s", item["quote"])) and not re.search(rf"{y}(?!s)", item["quote"])


def _speed_unquoted(field: str, item: dict[str, Any]) -> bool:
    """Whole-second speeds must stand alone in the quote ("1 second"), not inside "1/5"."""
    if field != "shutter_speeds":
        return False
    for k in ("fastest", "slowest"):
        v = str(item["value"].get(k) or "")
        if re.fullmatch(r"\d+(\.\d+)?", v):
            if not re.search(rf"(?<![/\d.]){re.escape(v)}(?![/\d])", item["quote"]):
                return True
    return False


def accept(raw: dict[str, Any], article: str) -> tuple[dict[str, Any], list[str]]:
    """Fields whose quote is in the article; the names of dropped ones."""
    kept: dict[str, Any] = {"covers_several_models": bool(raw.get("covers_several_models"))}
    dropped = []
    for f in FIELDS:
        item = raw.get(f)
        if not item or _empty(item.get("value")):
            continue
        if _decade_only(f, item) or _speed_unquoted(f, item):
            dropped.append(f)
        elif quote_found(item.get("quote", ""), article):
            kept[f] = item
        else:
            dropped.append(f)
    return kept, dropped


def _entry(a: dict[str, Any], message: Any) -> dict[str, Any]:
    base = {"key": cache_key(a), "card_id": a["card_id"], "title": a["title"]}
    usage = {
        "input_tokens": message.usage.input_tokens,
        "output_tokens": message.usage.output_tokens,
        "cache_read_input_tokens": message.usage.cache_read_input_tokens or 0,
    }
    if message.stop_reason != "end_turn":
        return {**base, "error": f"stop_reason {message.stop_reason}", "usage": usage}
    text = next((b.text for b in message.content if b.type == "text"), "")
    try:
        raw = json.loads(text)
    except json.JSONDecodeError as exc:
        return {**base, "error": f"invalid JSON: {exc}", "usage": usage}
    fields, dropped = accept(raw, a["text"])
    return {**base, "fields": fields, "dropped_unquoted": dropped, "usage": usage}


# --- cache


def load_cache() -> dict[str, dict[str, Any]]:
    if not CACHE.exists():
        return {}
    entries = (json.loads(line) for line in CACHE.read_text().splitlines() if line.strip())
    return {e["key"]: e for e in entries if "fields" in e}


def append_cache(entries: list[dict[str, Any]]) -> None:
    with CACHE.open("a") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")


def _todo(dump: Path) -> list[dict[str, Any]]:
    done = load_cache()
    return [a for a in articles(dump) if a["text"] and cache_key(a) not in done]


# --- runs


def pilot(dump: Path, n: int, seed: int = 1) -> list[dict[str, Any]]:
    todo = _todo(dump)
    sample = random.Random(seed).sample(todo, min(n, len(todo)))
    client = anthropic.Anthropic()
    entries = []
    for a in sample:
        message = client.messages.create(**request_params(a))
        entries.append(_entry(a, message))
    append_cache([e for e in entries if "fields" in e])
    return entries


def submit(dump: Path) -> dict[str, Any]:
    todo = _todo(dump)
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(
        requests=[{"custom_id": a["card_id"].replace(":", "_"), "params": request_params(a)}
                  for a in todo],
    )  # fmt: skip
    BATCHES.parent.mkdir(parents=True, exist_ok=True)
    log = json.loads(BATCHES.read_text()) if BATCHES.exists() else []
    log.append({"id": batch.id, "requests": len(todo), "model": MODEL, "prompt": PROMPT_VERSION})
    BATCHES.write_text(json.dumps(log, indent=1))
    return {"id": batch.id, "requests": len(todo)}


def status(batch_id: str) -> Any:
    return anthropic.Anthropic().messages.batches.retrieve(batch_id)


def collect(dump: Path, batch_id: str) -> dict[str, int]:
    by_custom = {a["card_id"].replace(":", "_"): a for a in articles(dump)}
    client = anthropic.Anthropic()
    entries, counts = [], {"ok": 0, "errored": 0, "failed": 0}
    for result in client.messages.batches.results(batch_id):
        a = by_custom.get(result.custom_id)
        if a is None:
            continue
        if result.result.type != "succeeded":
            counts["errored"] += 1
            continue
        e = _entry(a, result.result.message)
        counts["ok" if "fields" in e else "failed"] += 1
        entries.append(e)
    append_cache([e for e in entries if "fields" in e])
    errors = [e for e in entries if "error" in e]
    if errors:
        (OUT_DIR / "logs").mkdir(exist_ok=True)
        (OUT_DIR / "logs" / f"llm_errors_{batch_id}.jsonl").write_text(
            "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in errors)
        )
    return counts


def cost(entries: list[dict[str, Any]], batch: bool) -> float:
    """USD for these entries at MODEL's PRICES."""
    u = [e["usage"] for e in entries]
    fresh = sum(x["input_tokens"] for x in u)
    cached = sum(x["cache_read_input_tokens"] for x in u)
    out = sum(x["output_tokens"] for x in u)
    usd = (fresh * PRICES[0] + out * PRICES[1] + cached * PRICES[2]) / 1_000_000
    return usd / 2 if batch else usd
