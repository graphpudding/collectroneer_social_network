"""Entry point: `catalog run --category film_cameras [--stage recon]`, `catalog load FILE`."""

import argparse
import sys
from pathlib import Path

from core.config import list_categories, load_category
from core.stages import STAGES, StageNotImplemented, run_stages


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="catalog")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="run pipeline stages for a category")
    run.add_argument("--category", required=True)
    run.add_argument("--stage", choices=STAGES, help="run a single stage instead of all")

    sub.add_parser("categories", help="list configured categories")

    load = sub.add_parser("load", help="upsert a catalog JSON file into the database")
    load.add_argument("file", type=Path)

    imp = sub.add_parser("import-camerawiki", help="build film_cameras catalog.json from the dump")
    imp.add_argument("dump", type=Path)
    imp.add_argument("--sample", type=Path, help="hand-checked records that override the dump")

    llm = sub.add_parser("llm-extract", help="extract film_cameras fields from dump articles")
    llm.add_argument("dump", type=Path)
    mode = llm.add_mutually_exclusive_group(required=True)
    mode.add_argument("--pilot", type=int, metavar="N", help="run N articles directly")
    mode.add_argument("--submit", action="store_true", help="send the rest as a Message Batch")
    mode.add_argument("--status", metavar="BATCH_ID")
    mode.add_argument("--collect", metavar="BATCH_ID", help="read batch results into the cache")

    wd = sub.add_parser("wikidata", help="film_cameras from Wikidata")
    wd.add_argument("action", choices=["fetch", "match"])

    ue = sub.add_parser("user-edits", help="approved user edits from the product database")
    ue.add_argument("action", choices=["pull"])
    ue.add_argument("--category", default="film_cameras")

    args = parser.parse_args(argv)

    if args.command == "categories":
        print("\n".join(list_categories()))
        return 0

    if args.command == "load":
        return _load(args.file)

    if args.command == "wikidata":
        from core import wikidata_cameras

        if args.action == "fetch":
            print(f"{wikidata_cameras.fetch()} items")
        else:
            catalog = wikidata_cameras.OUT / "catalog.json"
            print(wikidata_cameras.match(catalog))
        return 0

    if args.command == "llm-extract":
        return _llm(args)

    if args.command == "user-edits":
        return _pull_user_edits(args.category)

    if args.command == "import-camerawiki":
        from core.camerawiki_import import build

        result = build(args.dump, args.sample)
        print(
            f"{result['records']} records, {result['relations']} relations, "
            f"{result['excluded']} excluded, {result['conflicts']} ID conflicts"
        )
        return 0

    try:
        config = load_category(args.category)
        run_stages(config, only=args.stage)
    except (FileNotFoundError, ValueError, StageNotImplemented) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


def _llm(args: argparse.Namespace) -> int:
    from core import llm_extract

    if args.pilot:
        entries = llm_extract.pilot(args.dump, args.pilot)
        for e in entries:
            got = [f for f in e.get("fields", {}) if f != "covers_several_models"]
            note = e.get("error") or f"{len(got)} fields, dropped {e['dropped_unquoted']}"
            print(f"{e['card_id']:22} {e['title'][:40]:40} {note}")
        per = llm_extract.cost(entries, batch=False) / max(len(entries), 1)
        print(
            f"cost ${per * len(entries):.2f}, ~${per:.4f} per article direct, half that in a batch"
        )
    elif args.submit:
        result = llm_extract.submit(args.dump)
        print(f"batch {result['id']}: {result['requests']} requests")
    elif args.status:
        b = llm_extract.status(args.status)
        print(b.processing_status, b.request_counts)
    else:
        print(llm_extract.collect(args.dump, args.collect))
    return 0


def _pull_user_edits(category: str) -> int:
    import psycopg

    from core import user_edits
    from core.config import CATEGORIES_DIR
    from core.db import database_url
    from core.registry import Registry

    out_dir = CATEGORIES_DIR / category
    registry_path = out_dir / "id_registry.csv"
    registry = Registry.load(category, registry_path)
    with psycopg.connect(database_url()) as conn:
        n = user_edits.pull(conn, category, out_dir / "user_edits.jsonl", registry)
    registry.save(registry_path)
    print(f"{n} approved edits -> {out_dir / 'user_edits.jsonl'}")
    return 0


def _load(file: Path) -> int:
    import psycopg

    from core.db import database_url, load_catalog

    try:
        with psycopg.connect(database_url()) as conn:
            records, relations = load_catalog(file, conn)
    except (FileNotFoundError, ValueError, psycopg.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"loaded {records} records, {relations} relations from {file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
