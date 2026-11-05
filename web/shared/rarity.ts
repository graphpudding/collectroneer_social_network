// Rarity, stage 1: from production numbers only. Thresholds come from rarity_scales
// (editable by admins). Later stages adjust by how often a model turns up in collections.
import type { ProductionCount } from "./catalog";

export type RarityLevel = { key: string; label: string; min_production: number };

export type Rarity = {
  levels: RarityLevel[];
  /** 0-based index into levels, most common first; null when not rated. */
  index: number | null;
  /** The production figure the rating is based on, and how it was given. */
  basis: { production: number; kind: "stated" | "estimate" | "range" } | null;
};

/** One number to rate by: the stated value, or the middle of a range. */
export function ratingProduction(p: ProductionCount | null): Rarity["basis"] {
  if (!p) return null;
  if (p.value != null) return { production: p.value, kind: p.basis === "estimate" || p.basis === "estimated" ? "estimate" : "stated" };
  if (p.min != null && p.max != null) return { production: Math.round((p.min + p.max) / 2), kind: "range" };
  return null;
}

export function rateRarity(levels: RarityLevel[], production: ProductionCount | null): Rarity {
  const basis = ratingProduction(production);
  // Levels are ordered common -> rare with falling thresholds; take the first one reached.
  const index = basis ? levels.findIndex((l) => basis.production >= l.min_production) : -1;
  return { levels, index: index >= 0 ? index : null, basis: index >= 0 ? basis : null };
}
