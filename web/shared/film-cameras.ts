// How film_cameras attributes read on the page (pipeline/categories/film_cameras/MODULE.md, section 5).
import type { CatalogEntry } from "./catalog";

export const CAMERA_TYPES: Record<string, string> = {
  slr: "SLR",
  rangefinder: "Rangefinder",
  tlr: "TLR",
  viewfinder: "Viewfinder",
  point_and_shoot: "Point-and-shoot",
  instant: "Instant",
  view_camera: "View camera",
  press: "Press camera",
  folding: "Folding",
  box: "Box camera",
  panoramic: "Panoramic",
  stereo: "Stereo",
  subminiature: "Subminiature",
  single_use: "Single-use",
  pinhole: "Pinhole",
};

export const SHUTTER_TYPES: Record<string, string> = {
  focal_plane: "Focal-plane",
  focal_plane_cloth: "Focal-plane, cloth",
  focal_plane_metal: "Focal-plane, metal",
  leaf: "Leaf",
  other: "Other",
};

export const METERING: Record<string, string> = {
  none: "None",
  built_in: "Built-in (not through the lens)",
  ttl: "TTL",
  ttl_otf: "TTL, off the film",
};

export const EXPOSURE_MODES: Record<string, string> = {
  manual: "Manual",
  aperture_priority: "Aperture priority",
  shutter_priority: "Shutter priority",
  program: "Program",
};

export const FOCUS: Record<string, string> = {
  manual: "Manual",
  autofocus: "Autofocus",
  zone: "Zone",
  fixed: "Fixed",
};

const FILM_FORMATS: Record<string, string> = { aps: "APS", disc: "Disc", sheet: "Sheet film", plate: "Plates" };

const label = (map: Record<string, string>, v: unknown) =>
  typeof v === "string" ? (map[v] ?? v.replace(/_/g, " ")) : undefined;

const list = (v: unknown, fn: (x: unknown) => string | undefined = String) =>
  Array.isArray(v) && v.length ? v.map(fn).filter(Boolean).join(", ") : undefined;

const filmFormat = (v: unknown) =>
  typeof v === "string"
    ? (FILM_FORMATS[v] ?? (v.startsWith("instant_") ? `Instant (${v.slice(8)})` : v))
    : undefined;

function shutterSpeeds(v: unknown) {
  if (!v || typeof v !== "object") return undefined;
  const { fastest, slowest, bulb } = v as { fastest?: string; slowest?: string; bulb?: boolean };
  const sec = (s?: string) => (s ? `${s} s` : undefined);
  const range = [sec(slowest), sec(fastest)].filter(Boolean).join(" – ");
  return [range, bulb ? "B" : undefined].filter(Boolean).join(", ") || undefined;
}

function frameSize(v: unknown) {
  if (typeof v !== "string") return undefined;
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(v);
  return m ? `${m[1]} × ${m[2]} mm` : v.replace(/_/g, " ");
}

export type SpecRow = {
  label: string;
  value: string;
  /** field_sources key, for the source superscript. */
  field: string;
  /** Rendered as a link to the catalog filtered by this value. */
  filter?: { key: string; value: string };
};
export type SpecGroup = { title: string; rows: SpecRow[] };

type Draft = [label: string, value: string | undefined | null, field: string, filter?: string];

export function specGroups(e: CatalogEntry): SpecGroup[] {
  const a = e.attributes;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const groups: { title: string; rows: Draft[] }[] = [
    {
      title: "General",
      rows: [
        ["Type", label(CAMERA_TYPES, a.camera_type), "attributes.camera_type"],
        ["Film format", list(a.film_format, filmFormat), "attributes.film_format"],
        ["Frame size", frameSize(a.frame_size), "attributes.frame_size"],
        ["Lens mount", str(a.lens_mount), "attributes.lens_mount", "lens_mount"],
        ["Lens", str(a.fixed_lens), "attributes.fixed_lens"],
        ["Made by", list(a.manufacturer), "attributes.manufacturer"],
        ["Country", e.country, "country", "country"],
      ],
    },
    {
      title: "Exposure",
      rows: [
        ["Shutter", label(SHUTTER_TYPES, a.shutter_type), "attributes.shutter_type"],
        ["Speeds", shutterSpeeds(a.shutter_speeds), "attributes.shutter_speeds"],
        ["Metering", label(METERING, a.metering), "attributes.metering"],
        ["Modes", list(a.exposure_modes, (x) => label(EXPOSURE_MODES, x)), "attributes.exposure_modes"],
      ],
    },
    {
      title: "Other",
      rows: [
        ["Focus", label(FOCUS, a.focus), "attributes.focus"],
        ["Power", str(a.power), "attributes.power"],
      ],
    },
  ];
  return groups
    .map((g) => ({
      title: g.title,
      rows: g.rows
        .filter((r): r is [string, string, string, string?] => !!r[1])
        .map(([l, v, field, filterKey]) => ({
          label: l,
          value: v,
          field,
          filter: filterKey ? { key: filterKey, value: v } : undefined,
        })),
    }))
    .filter((g) => g.rows.length);
}

/** "135" reads as "35mm" in short lines; the full name stays in the specifications. */
const shortFormat = (a: Record<string, unknown>) =>
  Array.isArray(a.film_format) && a.film_format.length
    ? a.film_format.map((f) => (f === "135" ? "35mm" : filmFormat(f))).join(", ")
    : undefined;

/** Key facts of a model: ["Rangefinder", "35mm"]. Years and country are added by the caller. */
export function keyFacts(a: Record<string, unknown>) {
  return [label(CAMERA_TYPES, a.camera_type), shortFormat(a)].filter((x): x is string => !!x);
}

export const cameraTypeLabel = (a: Record<string, unknown>) => label(CAMERA_TYPES, a.camera_type);

/** Filter option labels for the catalog page. */
export function facetLabel(key: string, value: string) {
  if (key === "camera_type") return label(CAMERA_TYPES, value) ?? value;
  if (key === "film_format") return filmFormat(value) ?? value;
  return value;
}
