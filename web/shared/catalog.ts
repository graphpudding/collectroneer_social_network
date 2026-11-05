// Types and helpers shared by the API and the pages. Row types come from kanel (shared/types/db).
import type CatalogEntries from "./types/db/public/CatalogEntries";
import type { Rarity } from "./rarity";

export const SITE_NAME = "Collectors Note";

export type ProductionCount = {
  value?: number;
  min?: number;
  max?: number;
  basis?: "stated" | "estimate" | "range" | string;
  source?: { url: string; quote?: string };
};

export type SerialRange = {
  from: number | string;
  to: number | string;
  year?: number;
  variant?: string;
  source?: string;
};

/** A catalog record as the API returns it: kanel row with JSON columns typed, search columns dropped. */
export type CatalogEntry = Omit<
  CatalogEntries,
  "labels" | "production_count" | "attributes" | "external_ids" | "field_sources"
  | "search_text" | "search_compact" | "created_at" | "updated_at"
> & {
  labels: Record<string, string>;
  production_count: ProductionCount | null;
  attributes: Record<string, unknown>;
  external_ids: Record<string, string>;
  field_sources: Record<string, string>;
};

/** What a grid tile needs. */
export type CatalogCard = Pick<
  CatalogEntry,
  "id" | "name" | "maker" | "year_start" | "year_end" | "country" | "image_url" | "attributes"
> & {
  /** Name of the model this one is a variant of, if any. */
  variant_of_name: string | null;
};

export type FacetValue = { value: string; count: number };

export type CatalogList = {
  items: CatalogCard[];
  total: number;
  facets: Record<string, FacetValue[]>;
};

export type CatalogDetail = {
  entry: CatalogEntry;
  rarity: Rarity | null;
  variantOf: CatalogCard[];
  variants: CatalogCard[];
};

export type Filter = {
  key: string;
  label: string;
  /**
   * column: a catalog_entries column; scalar / array: a key inside attributes;
   * decade: derived from year_start, values like "1970s".
   */
  kind: "column" | "scalar" | "array" | "decade";
};

export type Sort = "az" | "year";

export type Section = {
  category: string;
  path: string; // URL segment: /cameras
  title: string;
  filters: Filter[];
};

export const SECTIONS: Section[] = [
  {
    category: "film_cameras",
    path: "cameras",
    title: "Film cameras",
    filters: [
      { key: "camera_type", label: "Type", kind: "scalar" },
      { key: "maker", label: "Manufacturer", kind: "column" },
      { key: "film_format", label: "Film format", kind: "array" },
      { key: "lens_mount", label: "Lens mount", kind: "scalar" },
      { key: "decade", label: "Decade", kind: "decade" },
      { key: "country", label: "Country", kind: "column" },
    ],
  },
];

export const sectionByPath = (path: string) => SECTIONS.find((s) => s.path === path);
export const sectionByCategory = (category: string) =>
  SECTIONS.find((s) => s.category === category);

export const PAGE_SIZE = 24;
export const MAX_LIMIT = 240;

/** Page numbers to show: first, last, and a window around the current one; null is a gap. */
export function pageNumbers(current: number, pages: number, around = 1): (number | null)[] {
  const keep = new Set([1, pages]);
  for (let p = current - around; p <= current + around; p++) if (p >= 1 && p <= pages) keep.add(p);
  // A gap of one page shows the page instead of "…".
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev === 2) out.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}

export const displayName = (e: Pick<CatalogEntry, "maker" | "name">) => `${e.maker} ${e.name}`;

/** "film_cameras:000001" -> "000001" */
export const idNumber = (id: string) => id.slice(id.indexOf(":") + 1);

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

/** /cameras/nikon-f2-000001. Only the trailing number identifies the record. */
export function entryPath(e: Pick<CatalogEntry, "id" | "category" | "maker" | "name">) {
  const section = sectionByCategory(e.category);
  return `/${section?.path ?? e.category}/${slugify(displayName(e))}-${idNumber(e.id)}`;
}

export const numberFromSlug = (slug: string) => /-(\d+)$/.exec(slug)?.[1] ?? /^(\d+)$/.exec(slug)?.[1];

export function years(e: Pick<CatalogEntry, "year_start" | "year_end">) {
  if (e.year_start && e.year_end) {
    return e.year_start === e.year_end ? `${e.year_start}` : `${e.year_start}–${e.year_end}`;
  }
  if (e.year_start) return `from ${e.year_start}`;
  if (e.year_end) return `until ${e.year_end}`;
  return "";
}

/**
 * Wikimedia Commons thumbnail for a direct upload URL. Temporary: SPEC section 10 wants our own
 * preview cache in R2 instead of hotlinking.
 */
export function thumbnail(url: string | null, width: 330 | 500 | 960 | 1280) {
  if (!url) return null;
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/(\w\/\w\w)\/([^/]+)$/.exec(url);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/${width}px-${m[3]}` : url;
}

/** "CC BY-SA 4.0" -> its deed URL; unknown strings -> null. */
export function licenseUrl(license: string | null) {
  if (!license) return null;
  if (/^CC0\b/i.test(license)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  const m = /^CC ((?:BY)(?:-(?:SA|NC|ND))*) (\d\.\d)$/i.exec(license.trim());
  return m ? `https://creativecommons.org/licenses/${m[1]!.toLowerCase()}/${m[2]}/` : null;
}
