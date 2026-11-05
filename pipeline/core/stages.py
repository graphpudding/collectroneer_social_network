"""Pipeline stages 1-9 (docs/SPEC.md, section 8). Identical for every category."""

from collections.abc import Callable

from core.config import CategoryConfig

STAGES = [
    "recon",
    "fetch",
    "scope",
    "parse",
    "normalize",
    "match",
    "assemble",
    "report",
    "publish",
]


class StageNotImplemented(Exception):
    pass


def _not_implemented(name: str) -> Callable[[CategoryConfig], None]:
    def run(config: CategoryConfig) -> None:
        raise StageNotImplemented(f"stage {name!r} is not implemented yet")

    return run


RUNNERS: dict[str, Callable[[CategoryConfig], None]] = {
    name: _not_implemented(name) for name in STAGES
}


def run_stages(config: CategoryConfig, only: str | None = None) -> None:
    for name in [only] if only else STAGES:
        RUNNERS[name](config)
