"""film_cameras from a camera-wiki SQLite dump (db/cameras.sqlite, schema_version 2).

The dump already holds per-field extraction with evidence. Here the values are normalised to
the module's attribute schema (categories/film_cameras/MODULE.md, section 5) and every field
gets a status for the gaps list: ok (normalised), raw (source text we could not normalise yet,
a job for rules or the LLM stage) or missing (nothing in the source).

Photos are dropped: almost all are Flickr images shared "with permission" to camera-wiki only,
not under a licence we can use.
"""

import json
import re
import sqlite3
from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

CATEGORY = "film_cameras"
DATA_LICENSE = "GFDL 1.3"
YEAR_RANGE = (1839, 2026)

# Fields of the gaps list, in the order they appear on a model page.
GAP_FIELDS = (
    "year_start",
    "year_end",
    "country",
    "production_count",
    "image",
    "camera_type",
    "film_format",
    "frame_size",
    "lens",
    "shutter_type",
    "shutter_speeds",
    "metering",
    "exposure_modes",
    "focus",
    "power",
)

HOST_KEYS = {
    "camera-wiki.org": "camerawiki",
    "global.canon": "canon",
    "www.zenitcamera.com": "zenitcamera",
    "en.wikipedia.org": "enwiki",
    "www.wikidata.org": "wikidata",
}

MAKER_ALIASES = {
    "asahi pentax": "Pentax",
    "asahi optical": "Pentax",
    "nippon kogaku": "Nikon",
    "zenith": "Zenit",
    "fuji": "Fujifilm",
    "fujica": "Fujifilm",
    "belomo": "BelOMO",
    "fex": "Fex Indo",
}

COUNTRY_ALIASES = {
    "united states": "USA",
    "u.s.a.": "USA",
    "us": "USA",
    "england": "UK",
    "united kingdom": "UK",
    "great britain": "UK",
}

CAMERA_TYPES = {
    "slr": "slr",
    "tlr": "tlr",
    "rangefinder": "rangefinder",
    "viewfinder": "viewfinder",
    "folding": "folding",
    "box": "box",
    "instant": "instant",
    "compact": "point_and_shoot",
    "disposable": "single_use",
    "pinhole": "pinhole",
}
# camera_type is one value; the source often lists several ("folding", "rangefinder").
TYPE_PRIORITY = (
    "slr",
    "tlr",
    "instant",
    "folding",
    "rangefinder",
    "box",
    "single_use",
    "pinhole",
    "point_and_shoot",
    "viewfinder",
)

FILM_FORMATS = {"aps": "aps", "polaroid sx-70": "instant_sx70", "instax": "instant_instax"}

LENS_MOUNTS = (
    (r"\b42 ?mm screw|\bm42\b", "M42"),
    (r"\b39 ?mm screw|\bm39\b", "M39"),
    (r"pentax 645", "Pentax 645"),
    (r"^k ?mount|pentax k|\bkaf", "Pentax K"),
    (r"minolta sr", "Minolta SR"),
    (r"minolta af", "Minolta A"),
    (r"minolta v", "Minolta V"),
    (r"canon ef|^ef mount", "Canon EF"),
    (r"canon fd", "Canon FD"),
    (r"canon fl", "Canon FL"),
    (r"nikon f", "Nikon F"),
    (r"nikon s", "Nikon S"),
    (r"exakta", "Exakta"),
    (r"contax/yashica", "Contax/Yashica"),
    (r"contax rangefinder", "Contax RF"),
    (r"contax n", "Contax N"),
    (r"leica m", "Leica M"),
    (r"leica r", "Leica R"),
    (r"konica ar", "Konica AR"),
    (r"konica f", "Konica F"),
    (r"fujica x", "Fujica X"),
    (r"olympus om", "Olympus OM"),
    (r"mamiya z", "Mamiya Z"),
    (r"mamiya es", "Mamiya ES"),
    (r"mamiya cs", "Mamiya CS"),
    (r"praktica b", "Praktica B"),
    (r"topcon uv|uv topcon", "Topcon UV"),
    (r"miranda", "Miranda"),
    (r"kiev type c|pentacon six", "Pentacon Six"),
)

SHUTTER_ENUM = ("focal_plane", "focal_plane_cloth", "focal_plane_metal", "leaf", "other")
EXPOSURE_ORDER = ("manual", "aperture_priority", "shutter_priority", "program")
EXPOSURE_CODES = {"m": "manual", "a": "aperture_priority", "av": "aperture_priority"}
EXPOSURE_CODES |= {"s": "shutter_priority", "tv": "shutter_priority", "p": "program"}
EXPOSURE_WORDS = (
    (r"manual", "manual"),
    (r"aperture[- ]priority", "aperture_priority"),
    (r"shutter[- ](speed[- ])?priority", "shutter_priority"),
    (r"program", "program"),
)

# Categories that are never a maker: formats, countries, body types, eras.
NOT_MAKER = re.compile(
    r"\d|film|camera|mount|finder|folding|box|autofocus|panorama|toy|military|aerial|plate|"
    r"frame|lens|shutter|instant|half|disposable|compact|soviet|format|stereo|underwater|"
    r"^(USA|UK|US|France|China|Taiwan|Hong Kong|Japan|Germany|USSR|Belarus|Italy|Russia|Poland|"
    r"Spain|Argentina|Brazil|India|Bakelite|Bestiary|SLR|TLR|Pinhole|Super|Press|Unidentified|"
    r"APS|Macro|Focusing system|No-need-darkroom|Pseudo TLR|Sports)\b",
    re.I,
)
PROSE_MAKER = re.compile(
    r"(?:manufactured|made|produced|built|sold|marketed|distributed|designed|introduced)\s+"
    r"(?:\w+\s+){0,3}?by\s+(?:the\s+)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]"
    r"|\bbranded\s+(?:as\s+)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]"
    r"|\bmanu(?:facturer)?\s*[:=]\s*'*\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]",
    re.I,
)

NONE_TEXT = re.compile(r"^\s*(none|no|n/?a|-+|—)\.?\s*$", re.I)


def compact(s: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", s.lower())


def _json(v: Any) -> Any:
    if v in (None, ""):
        return None
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return v


def _items(v: Any) -> list:
    v = _json(v)
    if v in (None, "", [], {}):
        return []
    return v if isinstance(v, list) else [v]


def _text(v: Any) -> str | None:
    v = _json(v)
    if isinstance(v, list):
        v = "; ".join(str(x) for x in v)
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _year(v: Any) -> int | None:
    m = re.search(r"\b(18[3-9]\d|19\d\d|20[0-2]\d)\b", str(v)) if v not in (None, "") else None
    if not m:
        return None
    y = int(m.group(1))
    return y if YEAR_RANGE[0] <= y <= YEAR_RANGE[1] else None


# --- attribute normalisers: text from the dump -> module value, or None if not understood


def camera_type(values: Iterable[str]) -> str | None:
    found = {CAMERA_TYPES.get(str(v).lower()) for v in values} - {None}
    return next((t for t in TYPE_PRIORITY if t in found), None)


def film_formats(values: Iterable[str]) -> list[str]:
    out = []
    for v in values:
        s = str(v).strip().lower()
        f = FILM_FORMATS.get(s, s if re.fullmatch(r"\d{3}", s) else None)
        if f and f not in out:
            out.append(f)
    return out


def frame_size(text: str) -> str | None:
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(mm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?", text, re.I)
    if not m or m.group(4) == "cm" or re.search(r"\bcm\b", text[: m.end() + 4]):
        return None
    a, b = (m.group(i).replace(",", ".") for i in (1, 3))
    if not all(4 <= float(x) <= 300 for x in (a, b)):
        return None
    return f"{a}x{b}"


def lens_mount(text: str) -> str | None:
    low = text.lower()
    return next((name for pattern, name in LENS_MOUNTS if re.search(pattern, low)), None)


def shutter_type(text: str) -> str | None:
    low = text.lower()
    if "copal square" in low:
        return "focal_plane_metal"
    if re.search(r"focal[- ]?plane|(horizontal|vertical)(ly)?[- ]travel", low):
        if re.search(r"cloth|silk|fabric", low):
            return "focal_plane_cloth"
        if re.search(r"metal|titanium|steel|foil|alumin", low):
            return "focal_plane_metal"
        return "focal_plane"
    if re.search(
        r"\bleaf\b|(between|behind)[- ]the[- ]lens|compur|prontor|copal|seikosha|pronto|vario|"
        r"\bcentral\b|\bblade",
        low,
    ):
        return "leaf"
    if re.search(r"rotary|sector|guillotine|drop shutter", low):
        return "other"
    return None


def _seconds(s: str) -> str:
    return s[:-2] if s.endswith(".0") else s


def shutter_speeds(text: str) -> dict | None:
    fractions = [int(n) for n in re.findall(r"(?<![\d.])1\s*/\s*(\d{1,5})(?!\d)", text)]
    fractions = [n for n in fractions if 2 <= n <= 16000]
    if not fractions:
        return None
    seconds = [
        float(n)
        for n in re.findall(
            r"(?<![/\d.])(\d{1,2}(?:\.\d)?)\s*(?:\"|″|''|s\b|sec|second)", text, re.I
        )
    ]
    seconds += [float(t) for t in re.split(r"[,;]", text) if re.fullmatch(r"\s*\d{1,2}\s*", t)]
    seconds = [s for s in seconds if 0 < s <= 60]
    out: dict[str, Any] = {"fastest": f"1/{max(fractions)}"}
    if seconds:
        out["slowest"] = _seconds(str(max(seconds)))
    elif min(fractions) < max(fractions):
        out["slowest"] = f"1/{min(fractions)}"
    if re.search(r"\bB\b|bulb", text, re.I):
        out["bulb"] = True
    return out


def metering(text: str) -> str | None:
    low = text.lower()
    if NONE_TEXT.match(text) or re.search(r"\bno (light )?meter|without (a )?meter", low):
        return "none"
    if re.search(r"off[- ]the[- ]film|\botf\b", low):
        return "ttl_otf"
    if re.search(r"\bttl\b|through[- ]the[- ]lens", low):
        return "ttl"
    if re.search(r"selenium|\bcds\b|silicon|\bspd\b|\bgpd\b|photocell|meter|built[- ]in", low):
        return "built_in"
    return None


def exposure_modes(values: Iterable[str]) -> list[str]:
    found = set()
    for v in values:
        s = str(v).strip()
        code = EXPOSURE_CODES.get(s.lower())
        if code:
            found.add(code)
            continue
        found |= {mode for pattern, mode in EXPOSURE_WORDS if re.search(pattern, s, re.I)}
    return [m for m in EXPOSURE_ORDER if m in found]


def focus(text: str) -> str | None:
    low = text.lower()
    if re.search(r"fixed|focus[- ]free|fix[- ]focus", low):
        return "fixed"
    if re.search(
        r"auto ?-?focus|\baf\b|phase detection|infra-?red|triangulation|active (af|focus)", low
    ):
        return "autofocus"
    if re.search(r"\bzone|symbols?\b", low):
        return "zone"
    if re.search(
        r"manual|rangefinder|split|scale|helic|ground glass|focusing ring|coupled|bellows|"
        r"micro-?prism|front (cell|element)|rack",
        low,
    ):
        return "manual"
    return None


def power(text: str) -> str:
    if NONE_TEXT.match(text):
        return "None (mechanical)"
    return text.rstrip(". ")[:160]


def normalise_maker(name: str) -> str:
    return MAKER_ALIASES.get(name.strip().lower(), name.strip())


def normalise_country(name: str) -> str:
    return COUNTRY_ALIASES.get(name.strip().lower(), name.strip())


# --- LLM fields (core/llm_extract.py): already quote-checked, validated here like any source


def _llm_value(llm: dict[str, Any], field: str) -> Any:
    item = llm.get(field)
    return item["value"] if item else None


def fill_from_llm(
    c: "Converted",
    llm: dict[str, Any],
    rec: dict[str, Any],
    attrs: dict[str, Any],
    sources: dict[str, str],
    url: str,
) -> set[str]:
    """Fills gaps (status missing or raw) from LLM values; returns the record fields filled."""
    filled: set[str] = set()

    def put(gap_name: str, field: str, value: Any) -> None:
        if field.startswith("attributes."):
            attrs[field.split(".", 1)[1]] = value
        else:
            rec[field] = value
        sources[field] = url
        filled.add(field)
        c.status[gap_name] = "llm"
        c.raw.pop(gap_name, None)

    def want(gap_name: str) -> bool:
        return c.status[gap_name] != "ok"

    start = _llm_value(llm, "year_start")
    if want("year_start") and isinstance(start, int) and _year(start):
        if not rec.get("year_end") or rec["year_end"] >= start:
            put("year_start", "year_start", start)
    end = _llm_value(llm, "year_end")
    if want("year_end") and isinstance(end, int) and _year(end):
        if not rec.get("year_start") or end >= rec["year_start"]:
            put("year_end", "year_end", end)
    country = _llm_value(llm, "country")
    if want("country") and isinstance(country, str) and country.strip():
        put("country", "country", normalise_country(country))

    pc = _llm_value(llm, "production_count")
    if want("production_count") and isinstance(pc, dict):
        quote = llm["production_count"]["quote"]
        count: dict[str, Any] = {"basis": pc.get("basis", "stated")}
        if isinstance(pc.get("value"), int) and pc["value"] > 0:
            count["value"] = pc["value"]
        elif isinstance(pc.get("min"), int) and isinstance(pc.get("max"), int):
            if 0 < pc["min"] <= pc["max"]:
                count.update(min=pc["min"], max=pc["max"], basis="range")
        if "value" in count or "min" in count:
            count["source"] = {"url": url, "quote": quote}
            put("production_count", "production_count", count)

    ctype = _llm_value(llm, "camera_type")
    if want("camera_type") and ctype in TYPE_PRIORITY + ("view_camera", "press", "panoramic"):
        put("camera_type", "attributes.camera_type", ctype)
    formats = _llm_value(llm, "film_format")
    if want("film_format") and isinstance(formats, list):
        ok = [
            f.lower()
            for f in formats
            if re.fullmatch(r"\d{3}|aps|disc|sheet|plate|instant_\w+", f.lower())
        ]
        if ok:
            put("film_format", "attributes.film_format", list(dict.fromkeys(ok)))
    fs = _llm_value(llm, "frame_size")
    if want("frame_size") and isinstance(fs, str):
        fs = fs.replace(" ", "").replace("×", "x").lower().removesuffix("mm")
        if re.fullmatch(r"\d+(\.\d+)?x\d+(\.\d+)?", fs):
            put("frame_size", "attributes.frame_size", fs)

    if want("lens"):
        mount = _llm_value(llm, "lens_mount")
        fixed = _llm_value(llm, "fixed_lens")
        if isinstance(mount, str) and mount.strip():
            known = lens_mount(mount)
            if known or len(mount) <= 40:
                put("lens", "attributes.lens_mount", known or mount.strip())
        elif isinstance(fixed, str) and fixed.strip():
            put("lens", "attributes.fixed_lens", fixed.strip()[:160])

    for gap_name, choices in (
        ("shutter_type", SHUTTER_ENUM),
        ("metering", ("none", "built_in", "ttl", "ttl_otf")),
        ("focus", ("manual", "autofocus", "zone", "fixed")),
    ):
        v = _llm_value(llm, gap_name)
        if want(gap_name) and v in choices:
            put(gap_name, f"attributes.{gap_name}", v)

    ss = _llm_value(llm, "shutter_speeds")
    if want("shutter_speeds") and isinstance(ss, dict):
        speed = re.compile(r"1/\d{1,5}|\d{1,2}(\.\d)?")
        out: dict[str, Any] = {}
        for k in ("fastest", "slowest"):
            v = (ss.get(k) or "").strip().removesuffix("s").strip()
            if speed.fullmatch(v):
                out[k] = v
        if ss.get("bulb"):
            out["bulb"] = True
        if out.get("fastest"):
            put("shutter_speeds", "attributes.shutter_speeds", out)

    modes = _llm_value(llm, "exposure_modes")
    if want("exposure_modes") and isinstance(modes, list):
        ok = [m for m in EXPOSURE_ORDER if m in modes]
        if ok:
            put("exposure_modes", "attributes.exposure_modes", ok)
    p = _llm_value(llm, "power")
    if want("power") and isinstance(p, str) and p.strip():
        put("power", "attributes.power", power(p))
    return filled


# --- dump reading


def _maker_category(x: str) -> bool:
    return len(x) > 1 and not NOT_MAKER.search(x)


def host_key(url: str) -> str:
    host = urlparse(url).hostname or ""
    return HOST_KEYS.get(host, host.removeprefix("www."))


class Dump:
    def __init__(self, path: Path) -> None:
        self.conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        self.conn.row_factory = sqlite3.Row
        self.evidence: dict[tuple[str, str], str] = {}
        for camera_id, fld, url in self.conn.execute(
            "select camera_id, field, source_url from evidence"
        ):
            # A field's own source wins over camera-wiki when both are recorded.
            key = (camera_id, fld)
            if key not in self.evidence or host_key(self.evidence[key]) == "camerawiki":
                self.evidence[key] = url
        # Names known to be makers somewhere in the dump: a category counts as a maker when
        # it is one of these or a prefix of the camera's own name ("Topcon" for "Topcon RE").
        self.makers = {r[0] for r in self.conn.execute("select name from brands") if r[0]}
        for name, brand, candidates, categories in self.conn.execute(
            "select name, brand, manufacturer_candidates, categories from camera_cards"
        ):
            if brand:
                self.makers.add(brand)
            self.makers.update(_items(candidates))
            self.makers.update(
                x for x in _items(categories) if _maker_category(x) and name.startswith(x + " ")
            )

    def wikitext(self, page_id: str) -> str:
        row = self.conn.execute(
            "select wikitext from source_articles where page_id = ?", (int(page_id),)
        ).fetchone()
        return (row[0] if row else None) or ""

    def maker_of(self, card: sqlite3.Row) -> tuple[str, str] | None:
        """Maker for a card without a brand: (name, how it was found)."""
        name = card["name"]
        categories = [x for x in map(str, _items(card["categories"])) if _maker_category(x)]
        for x in categories:
            if name.startswith(x + " "):
                return x, "category"
        for x in sorted(self.makers, key=len, reverse=True):
            if name.startswith(x + " "):
                return x, "name prefix"
        for x in categories:
            if x in self.makers:
                return x, "category"
        m = PROSE_MAKER.search(self.wikitext(card["source_page_id"])[:4000])
        if m:
            groups = [g for g in m.groups()]
            found = next(groups[i + 1] or groups[i] for i in (0, 2, 4) if groups[i])
            return found.strip(), "article text"
        return None

    def cards(self) -> list[sqlite3.Row]:
        return self.conn.execute("select * from camera_cards order by id").fetchall()

    def source_of(self, card: sqlite3.Row, column: str) -> str:
        return self.evidence.get((card["id"], column), card["source_revision_url"])


class Converted:
    """One camera-wiki card in catalog shape, before an ID is assigned."""

    def __init__(self, source_id: str) -> None:
        self.source_id = source_id
        self.record: dict[str, Any] = {}
        self.status: dict[str, str] = dict.fromkeys(GAP_FIELDS, "missing")
        self.raw: dict[str, str] = {}
        self.hints: dict[str, str] = {}
        self.variant_of: str | None = None
        self.variants: list[str] = []
        self.skip_reason: str | None = None


def convert(card: sqlite3.Row, dump: Dump, llm: dict[str, Any] | None = None) -> Converted:
    """`llm`: quote-checked fields from the LLM cache; they only fill what is still missing."""
    c = Converted(card["id"])
    llm = llm or {}
    rec = c.record
    sources: dict[str, str] = {}  # record field -> source URL
    attrs: dict[str, Any] = {}

    def put(field: str, value: Any, column: str) -> None:
        url = dump.source_of(card, column)
        sources[field] = url
        if field.startswith("attributes."):
            attrs[field.split(".", 1)[1]] = value
        else:
            rec[field] = value

    def gap(name: str, value: Any, raw_text: str | None) -> bool:
        if value not in (None, [], ""):
            c.status[name] = "ok"
            return True
        if raw_text:
            c.status[name] = "raw"
            c.raw[name] = raw_text
        return False

    candidates = _items(card["manufacturer_candidates"])
    maker_raw = _text(card["brand"]) or (candidates[0] if candidates else None)
    maker_raw = maker_raw or _text(card["manufacturer"])
    maker_how = None
    if not maker_raw:
        found = dump.maker_of(card)
        if not found and llm.get("maker"):
            found = (llm["maker"]["value"], "article text (LLM)")
        if found:
            maker_raw, maker_how = found
    title = unquote(urlparse(card["source_url"]).path.rsplit("/", 1)[-1]).replace("_", " ")
    full_name = card["name"].strip()
    if not maker_raw:
        c.skip_reason = "no maker in source"
        rec.update(name=full_name)
        return c
    maker = normalise_maker(maker_raw)
    brand_column = "brand" if _text(card["brand"]) else "manufacturer_candidates"
    name = full_name
    for prefix in {maker, maker_raw}:
        if name.lower().startswith(prefix.lower() + " "):
            name = name[len(prefix) + 1 :]
            break

    # Canon's own index joins market names: "Sure Shot Max/Prima 5/Autoboy Mini". The first is
    # the name, the rest are aliases. Only when every part is a whole model name (a digit or two
    # words): "II/III/IV", "Espio/IQZoom 105SW" or "Argus/Cosina STL 1000" stay one name.
    market_names = [p.strip() for p in name.split("/")]
    whole = [len(p) >= 5 and bool(re.search(r"\d| ", p)) for p in market_names]
    if len(market_names) > 1 and all(whole) and not name.startswith("("):
        name = market_names[0]
    else:
        market_names = []
    rec.update(category=CATEGORY, name=name, labels={"en": f"{maker} {name}"})
    put("maker", maker, brand_column)
    if maker_how:
        c.hints["maker"] = f"maker from {maker_how}, check"
    sources["name"] = card["source_revision_url"]
    sources["labels"] = card["source_revision_url"]
    # Only regional model names: camera-wiki redirects often point at a related model
    # (Brownie Bullet -> Brownie Holiday), not at another name for this one.
    aliases = [
        a["name"]
        for a in _items(card["aliases"])
        if isinstance(a, dict) and a.get("relation") == "manufacturer_regional_model_name"
    ]
    aliases += [f"{maker} {p}" for p in market_names[1:]]
    own = compact(f"{maker} {name}")
    rec["aliases"] = sorted({a for a in aliases if a and compact(a) not in (own, compact(name))})

    # Years: explicit fields first, then the year category ("1971"), which camera-wiki uses
    # for the year of introduction.
    start = None
    for column in ("production_start", "introduction_year", "introduction_text"):
        start = _year(card[column])
        if start:
            put("year_start", start, column)
            break
    if not start:
        cats = [str(x) for x in _items(card["categories"]) if re.fullmatch(r"\d{4}", str(x))]
        years = sorted(y for y in map(_year, cats) if y)
        if years:
            start = years[0]
            sources["year_start"] = card["source_revision_url"]
            rec["year_start"] = start
    gap("year_start", start, _text(card["production_period_text"]))

    end = None
    for column in ("production_end", "discontinuation_year"):
        end = _year(card[column])
        if end:
            break
    if end and start and end < start:
        c.hints["year_end"] = f"source end {end} is before start {start}"
        end = None
    if end:
        put("year_end", end, column)
    gap("year_end", end, None)

    country_status = card["country_of_manufacture_status"] or ""
    country = _text(card["country_of_manufacture"])
    if country and not country_status.startswith("inferred_possible"):
        put("country", normalise_country(country), "country_of_manufacture")
        c.status["country"] = "ok"
    else:
        if country:
            c.hints["country"] = f"{country} (inferred from the brand's factory timeline)"
        hypothesis = _json(card["country_of_manufacture_hypothesis"])
        if isinstance(hypothesis, dict) and hypothesis.get("country"):
            hint = f"{hypothesis['country']} (camera-wiki category, brand nationality)"
            c.hints["country"] = c.hints.get("country", hint)

    pq = _json(card["production_quantity"])
    if isinstance(pq, dict) and isinstance(pq.get("value"), int):
        rec["production_count"] = {
            "value": pq["value"],
            "basis": "stated",
            "source": {"url": pq.get("source_url"), "quote": pq.get("scope")},
        }
        sources["production_count"] = pq.get("source_url") or card["source_revision_url"]
        c.status["production_count"] = "ok"

    # Attributes.
    ctype = camera_type(_items(card["camera_type"]))
    if ctype:
        put("attributes.camera_type", ctype, "camera_type")
    gap("camera_type", ctype, None)

    formats = film_formats(_items(card["film_format"]))
    if formats:
        put("attributes.film_format", formats, "film_format")
    gap("film_format", formats, _text(card["film_format_text"]))

    fs_text = _text(card["frame_size"])
    fs = frame_size(fs_text) if fs_text else None
    if fs:
        put("attributes.frame_size", fs, "frame_size")
    gap("frame_size", fs, fs_text)

    mount_texts = [str(x) for x in _items(card["lens_mount"])]
    mount = next((m for m in map(lens_mount, mount_texts) if m), None)
    fixed = card["lens_attachment"] == "fixed" or mount_texts == ["fixed"]
    lens_text = _text(card["lens_specification"]) or _text(card["fixed_lens"])
    # No mount and the lens text reads like a lens ("Zuiko 33mm f/4.5"): a fixed lens.
    if not mount and lens_text and not fixed:
        fixed = bool(
            re.search(r"\d\s*mm", lens_text, re.I)
            and re.search(r"\bf\s*/?\s*\d|1\s*:\s*\d|\bf\d", lens_text, re.I)
            and not re.search(r"mount|bayonet|screw|interchangeable|lenses", lens_text, re.I)
        )
    if mount and not fixed:
        put("attributes.lens_mount", mount, "lens_mount")
        gap("lens", mount, None)
    elif fixed and lens_text:
        put("attributes.fixed_lens", lens_text[:160], "lens_specification")
        gap("lens", lens_text, None)
    else:
        gap("lens", None, "; ".join(mount_texts) or lens_text)

    st_text = _text(card["shutter_type"])
    st = shutter_type(st_text) if st_text else None
    if st:
        put("attributes.shutter_type", st, "shutter_type")
    gap("shutter_type", st, st_text)

    ss_text = _text(card["shutter_speeds"])
    ss_column = "shutter_speeds"
    if not ss_text and st_text and shutter_speeds(st_text):
        ss_text, ss_column = st_text, "shutter_type"
    ss = shutter_speeds(ss_text) if ss_text else None
    if ss:
        put("attributes.shutter_speeds", ss, ss_column)
    gap("shutter_speeds", ss, ss_text)

    m_text = _text(card["metering"]) or _text(card["exposure_control"])
    m = metering(m_text) if m_text else None
    if m:
        put("attributes.metering", m, "metering" if _text(card["metering"]) else "exposure_control")
    gap("metering", m, m_text)

    mode_values = [str(x) for x in _items(card["exposure_modes"])]
    modes = exposure_modes(mode_values)
    if modes:
        put("attributes.exposure_modes", modes, "exposure_modes")
    gap("exposure_modes", modes, "; ".join(mode_values) or None)

    f_text = _text(card["focus"])
    fc = focus(f_text) if f_text else None
    if not fc and ctype in ("single_use", "pinhole", "box"):
        fc = "fixed" if ctype != "box" else None
    if fc:
        put("attributes.focus", fc, "focus")
    gap("focus", fc, f_text)

    p_text = _text(card["power"])
    if p_text:
        put("attributes.power", power(p_text), "power")
    gap("power", p_text, None)

    manufacturer = _text(card["manufacturer"])
    if manufacturer and compact(manufacturer) != compact(maker):
        put("attributes.manufacturer", [manufacturer], "manufacturer")

    if llm.get("manufacturer") and "manufacturer" not in attrs:
        m = llm["manufacturer"]["value"].strip()
        if compact(m) != compact(maker):
            attrs["manufacturer"] = [m]
            sources["attributes.manufacturer"] = card["source_revision_url"]
    from_llm = fill_from_llm(c, llm, rec, attrs, sources, card["source_revision_url"])
    if maker_how == "article text (LLM)":
        from_llm.add("maker")

    rec["attributes"] = attrs
    rec["external_ids"] = {"camerawiki": title}
    rec["source_urls"] = list(dict.fromkeys([card["source_revision_url"], *sources.values()]))
    rec["field_sources"] = {
        f: host_key(u) + ("_llm" if f in from_llm else "") for f, u in sources.items()
    }
    rec["data_license"] = DATA_LICENSE
    rec["attribution"] = [f'Camera-wiki contributors, "{title}", camera-wiki.org, GFDL 1.3']
    rec["match_confidence"] = "low"

    base = _text(card["base_model_id"])
    c.variant_of = base if base and base != card["id"] else None
    c.variants = [v["id"] for v in _items(card["variants"]) if isinstance(v, dict) and v.get("id")]
    return c
