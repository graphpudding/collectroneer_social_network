"""Stable ID registry (docs/SPEC.md, section 4): categories/<category>/id_registry.csv.

An ID is given out once: a record whose match keys (`source:value`) are already known gets
the same ID back; keys pointing at two IDs are a conflict for review, never a silent merge.
"""

import csv
from dataclasses import dataclass, field
from pathlib import Path

FIELDS = ("id", "status", "merged_into", "match_keys", "first_seen_run", "last_seen_run")


@dataclass
class Entry:
    id: str
    status: str = "active"
    merged_into: str = ""
    match_keys: list[str] = field(default_factory=list)
    first_seen_run: str = ""
    last_seen_run: str = ""


class IdConflict(Exception):
    def __init__(self, keys: list[str], ids: list[str]) -> None:
        super().__init__(f"keys {', '.join(keys)} point at {', '.join(ids)}")
        self.keys = keys
        self.ids = ids


class Registry:
    def __init__(self, category: str, entries: list[Entry] | None = None) -> None:
        self.category = category
        self.entries: dict[str, Entry] = {}
        self._by_key: dict[str, str] = {}
        for e in entries or []:
            self._add(e)

    @classmethod
    def load(cls, category: str, path: Path) -> "Registry":
        if not path.exists():
            return cls(category)
        with path.open(newline="") as f:
            rows = list(csv.DictReader(f))
        return cls(
            category,
            [
                Entry(
                    id=r["id"],
                    status=r["status"],
                    merged_into=r["merged_into"],
                    match_keys=[k for k in r["match_keys"].split("|") if k],
                    first_seen_run=r["first_seen_run"],
                    last_seen_run=r["last_seen_run"],
                )
                for r in rows
            ],
        )

    def save(self, path: Path) -> None:
        with path.open("w", newline="") as f:
            w = csv.DictWriter(f, FIELDS)
            w.writeheader()
            for e in sorted(self.entries.values(), key=lambda e: e.id):
                w.writerow(
                    {
                        "id": e.id,
                        "status": e.status,
                        "merged_into": e.merged_into,
                        "match_keys": "|".join(e.match_keys),
                        "first_seen_run": e.first_seen_run,
                        "last_seen_run": e.last_seen_run,
                    }
                )

    def _add(self, e: Entry) -> None:
        self.entries[e.id] = e
        for k in e.match_keys:
            self._by_key[k] = e.id

    def _next_id(self) -> str:
        used = [int(i.split(":", 1)[1]) for i in self.entries]
        return f"{self.category}:{max(used, default=0) + 1:06d}"

    def assign(self, keys: list[str], run: str) -> str:
        """ID for a record with these match keys; new keys are remembered."""
        ids = sorted({self._by_key[k] for k in keys if k in self._by_key})
        if len(ids) > 1:
            raise IdConflict(keys, ids)
        if ids:
            entry = self.entries[ids[0]]
        else:
            entry = Entry(id=self._next_id(), first_seen_run=run)
            self.entries[entry.id] = entry
        for k in keys:
            if k not in entry.match_keys:
                entry.match_keys.append(k)
                self._by_key[k] = entry.id
        entry.last_seen_run = run
        return entry.id
