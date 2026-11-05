"""Category module config (categories/<category>/config.yaml)."""

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_DIR = PIPELINE_ROOT / "categories"

ADAPTERS = {
    "wikidata_sparql",
    "mediawiki_api",
    "commons_imageinfo",
    "rest_api",
    "dump_file",
    "user_edits",
}


class SourceConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    adapter: str
    # Licence facts are filled in during recon from the source's own terms, never from memory.
    license: str | None = None
    share_alike: bool | None = None
    attribution: str | None = None
    terms_url: str | None = None
    requests_per_second: float = Field(default=0.5, gt=0)
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _known_adapter(self) -> "SourceConfig":
        if self.adapter not in ADAPTERS:
            raise ValueError(
                f"unknown adapter {self.adapter!r}, expected one of {sorted(ADAPTERS)}"
            )
        return self


class PilotConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    makers: list[str] = Field(default_factory=list)


class CategoryConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    title: str
    year_range: tuple[int, int]
    sources: dict[str, SourceConfig] = Field(default_factory=dict)
    pilot: PilotConfig = Field(default_factory=PilotConfig)

    @property
    def dir(self) -> Path:
        return CATEGORIES_DIR / self.category


def list_categories() -> list[str]:
    return sorted(p.parent.name for p in CATEGORIES_DIR.glob("*/config.yaml"))


def load_category(category: str) -> CategoryConfig:
    path = CATEGORIES_DIR / category / "config.yaml"
    if not path.is_file():
        raise FileNotFoundError(
            f"no config for category {category!r} at {path}; known: {list_categories()}"
        )
    config = CategoryConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    if config.category != category:
        raise ValueError(f"{path}: category key {config.category!r} does not match folder name")
    return config
