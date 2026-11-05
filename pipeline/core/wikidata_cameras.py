"""film_cameras from Wikidata: one SPARQL query for all camera models, matched to the catalog.

`catalog wikidata fetch` saves the raw answer under categories/film_cameras/raw/wikidata/;
`catalog wikidata match` pairs items with catalog records by maker + model name and writes
review/wikidata_matches.csv (exact matches) and review/wikidata_unmatched.csv.
"""

import csv
import json
import re
from pathlib import Path
from typing import Any

from core.adapters.camerawiki_dump import normalise_maker
from core.config import CATEGORIES_DIR
from core.http import PoliteClient

SPARQL = "https://query.wikidata.org/sparql"
OUT = CATEGORIES_DIR / "film_cameras"
RAW = OUT / "raw" / "wikidata" / "camera_models.json"

# Camera models (Q20888659) and still-camera subclasses with a manufacturer, minus digital,
# movie and video cameras (classes found in recon, raw/recon/wikidata/).
QUERY = """
SELECT ?i (SAMPLE(?enLabel) AS ?en) (SAMPLE(?ruLabel) AS ?ru) (SAMPLE(?deLabel) AS ?de)
  (SAMPLE(?jaLabel) AS ?ja)
  (GROUP_CONCAT(DISTINCT ?makerName; separator="|") AS ?makers)
  (GROUP_CONCAT(DISTINCT ?brandName; separator="|") AS ?brands)
  (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
  (SAMPLE(?image) AS ?img) (SAMPLE(?cc) AS ?commonsCat) (MIN(?y) AS ?year)
  (SAMPLE(?enT) AS ?enwiki) (SAMPLE(?ruT) AS ?ruwiki) (SAMPLE(?deT) AS ?dewiki)
  (SAMPLE(?jaT) AS ?jawiki)
WHERE {
  { ?i wdt:P31 wd:Q20888659 } UNION
  { ?i wdt:P279/wdt:P279* wd:Q15328 ; wdt:P176 [] } UNION
  { ?i wdt:P31/wdt:P279* wd:Q15328 ; wdt:P176 [] }
  FILTER NOT EXISTS { ?i (wdt:P31|wdt:P279)/wdt:P279* wd:Q62927 }
  FILTER NOT EXISTS { ?i (wdt:P31|wdt:P279)/wdt:P279* wd:Q335095 }
  FILTER NOT EXISTS { ?i (wdt:P31|wdt:P279)/wdt:P279* wd:Q100349043 }
  OPTIONAL { ?i rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?i rdfs:label ?ruLabel FILTER(LANG(?ruLabel) = "ru") }
  OPTIONAL { ?i rdfs:label ?deLabel FILTER(LANG(?deLabel) = "de") }
  OPTIONAL { ?i rdfs:label ?jaLabel FILTER(LANG(?jaLabel) = "ja") }
  OPTIONAL { ?i skos:altLabel ?alias FILTER(LANG(?alias) = "en") }
  OPTIONAL { ?i wdt:P176 ?maker . ?maker rdfs:label ?makerName FILTER(LANG(?makerName) = "en") }
  OPTIONAL { ?i wdt:P1716 ?brand . ?brand rdfs:label ?brandName FILTER(LANG(?brandName) = "en") }
  OPTIONAL { ?i wdt:P18 ?image }
  OPTIONAL { ?i wdt:P373 ?cc }
  OPTIONAL { ?i (wdt:P571|wdt:P5204) ?date BIND(YEAR(?date) AS ?y) }
  OPTIONAL { ?e schema:about ?i ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enT }
  OPTIONAL { ?r schema:about ?i ; schema:isPartOf <https://ru.wikipedia.org/> ; schema:name ?ruT }
  OPTIONAL { ?d schema:about ?i ; schema:isPartOf <https://de.wikipedia.org/> ; schema:name ?deT }
  OPTIONAL { ?j schema:about ?i ; schema:isPartOf <https://ja.wikipedia.org/> ; schema:name ?jaT }
}
GROUP BY ?i
"""


def fetch() -> int:
    with PoliteClient("wikidata", 0.5, timeout=120.0) as client:
        r = client.get(SPARQL, params={"query": QUERY, "format": "json"})
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(r.text)
    return len(r.json()["results"]["bindings"])


def items() -> list[dict[str, Any]]:
    rows = json.loads(RAW.read_text())["results"]["bindings"]
    out = []
    for row in rows:
        v = {k: x["value"] for k, x in row.items()}
        v["qid"] = v.pop("i").rsplit("/", 1)[-1]
        for k in ("makers", "brands", "aliases"):
            v[k] = [x for x in v.get(k, "").split("|") if x]
        out.append(v)
    return out


def compact(s: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", s.lower())


# Company names on Wikidata are often longer than the brand on the camera.
COMPANY_WORDS = re.compile(
    r"\b(corporation|corp|company|co|ltd|limited|inc|gmbh|ag|kg|optical|kogaku|kōgaku|"
    r"camera|cameras|works|industries|industry|holdings|group|imaging)\b\.?",
    re.I,
)


def maker_keys(names: list[str]) -> set[str]:
    keys = set()
    for n in names:
        keys.add(compact(n))
        short = COMPANY_WORDS.sub(" ", n).strip(" ,.")
        if short:
            keys.add(compact(short))
            keys.add(compact(short.split()[0]))
    return keys - {""}


def name_keys(item: dict[str, Any]) -> set[str]:
    labels = [item.get(k) for k in ("en", "enwiki", "de", "dewiki")] + item["aliases"]
    return {compact(re.sub(r"\s*\(.*?\)\s*", " ", x)) for x in labels if x} - {""}


def match(catalog_path: Path) -> dict[str, int]:
    records = json.loads(catalog_path.read_text())["records"]
    by_full: dict[str, list[dict[str, Any]]] = {}
    for r in records:
        keys = {compact(f"{r['maker']} {r['name']}")}
        # "F50 (N50)": both model codes count; "Brownie (110)" is a disambiguation, not a name.
        m = re.fullmatch(r"(.+?)\s*\((.+)\)", r["name"])
        if m and all(re.search(r"\d", g) for g in m.groups()):
            keys |= {compact(f"{r['maker']} {m.group(1)}"), compact(f"{r['maker']} {m.group(2)}")}
        keys |= {compact(a) for a in r.get("aliases", [])}
        for k in keys:
            by_full.setdefault(k, []).append(r)

    matched, unmatched, ambiguous = [], [], []
    taken: dict[str, str] = {}
    for it in items():
        makers = maker_keys(it["makers"] + it["brands"])
        hits: dict[str, dict[str, Any]] = {}
        for nk in name_keys(it):
            for r in by_full.get(nk, []):
                hits[r["id"]] = r
            # Label without the brand ("F2"): needs the maker to agree.
            for mk in makers:
                for r in by_full.get(mk + nk, []):
                    hits[r["id"]] = r
        # Label with another spelling of the brand ("Fuji GX680" for Fujifilm GX680).
        label = it.get("en", "")
        if " " in label:
            first, rest = label.split(" ", 1)
            for r in by_full.get(compact(normalise_maker(first)) + compact(rest), []):
                hits[r["id"]] = r
        row = [it["qid"], it.get("en", ""), "; ".join(it["makers"] + it["brands"])]
        if len(hits) == 1:
            r = next(iter(hits.values()))
            if r["id"] in taken:
                ambiguous.append([*row, f"{r['id']} also matched {taken[r['id']]}"])
                continue
            taken[r["id"]] = it["qid"]
            matched.append(
                [
                    *row,
                    r["id"],
                    f"{r['maker']} {r['name']}",
                    it.get("img", ""),
                    it.get("enwiki", ""),
                ]
            )
        elif hits:
            ambiguous.append([*row, " ".join(sorted(hits))])
        else:
            unmatched.append([*row, it.get("enwiki", ""), it.get("img", "")])

    review = OUT / "review"
    header = ["qid", "label", "makers"]
    _csv(review / "wikidata_matches.csv",
         [*header, "id", "catalog_name", "image", "enwiki"], matched)  # fmt: skip
    _csv(review / "wikidata_ambiguous.csv", [*header, "candidates"], ambiguous)
    _csv(review / "wikidata_unmatched.csv", [*header, "enwiki", "image"], unmatched)
    return {"items": len(matched) + len(ambiguous) + len(unmatched), "matched": len(matched),
            "ambiguous": len(ambiguous), "unmatched": len(unmatched)}  # fmt: skip


def _csv(path: Path, header: list[str], rows: list[list[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
