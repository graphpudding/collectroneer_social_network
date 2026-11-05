// What users may change in a film camera record, and how values are checked. The same rules
// run in the suggestion form and on the server.
import { CAMERA_TYPES, EXPOSURE_MODES, FOCUS, METERING, SHUTTER_TYPES } from "./film-cameras";

export type FieldKind = "year" | "text" | "enum" | "enum[]" | "production" | "speeds" | "alias";
export type EditableField = { path: string; label: string; kind: FieldKind; options?: Record<string, string>; max?: number };

export const FILM_FORMAT_OPTIONS: Record<string, string> = {
  "135": "135 (35mm)", "120": "120", "220": "220", "620": "620", "127": "127", "110": "110", "126": "126",
  "116": "116", "616": "616", "828": "828", aps: "APS", disc: "Disc", sheet: "Sheet film", plate: "Plates",
  instant_sx70: "Instant (SX-70)", instant_600: "Instant (600)", instant_packfilm: "Instant (pack film)",
  instant_instax: "Instant (Instax)",
};

export const EDITABLE_FIELDS: EditableField[] = [
  { path: "maker", label: "Maker (brand)", kind: "text", max: 60 },
  { path: "name", label: "Model name", kind: "text", max: 120 },
  { path: "aliases", label: "Another name (alias)", kind: "alias", max: 120 },
  { path: "year_start", label: "First year", kind: "year" },
  { path: "year_end", label: "Last year", kind: "year" },
  { path: "country", label: "Country of manufacture", kind: "text", max: 40 },
  { path: "production_count", label: "Production (units made)", kind: "production" },
  { path: "attributes.camera_type", label: "Type", kind: "enum", options: CAMERA_TYPES },
  { path: "attributes.film_format", label: "Film format", kind: "enum[]", options: FILM_FORMAT_OPTIONS },
  { path: "attributes.frame_size", label: "Frame size (mm, e.g. 24x36)", kind: "text", max: 20 },
  { path: "attributes.lens_mount", label: "Lens mount", kind: "text", max: 40 },
  { path: "attributes.fixed_lens", label: "Fixed lens", kind: "text", max: 160 },
  { path: "attributes.shutter_type", label: "Shutter", kind: "enum", options: SHUTTER_TYPES },
  { path: "attributes.shutter_speeds", label: "Shutter speeds", kind: "speeds" },
  { path: "attributes.metering", label: "Metering", kind: "enum", options: METERING },
  { path: "attributes.exposure_modes", label: "Exposure modes", kind: "enum[]", options: EXPOSURE_MODES },
  { path: "attributes.focus", label: "Focus", kind: "enum", options: FOCUS },
  { path: "attributes.power", label: "Power", kind: "text", max: 160 },
];
export const fieldByPath = (path: string) => EDITABLE_FIELDS.find((f) => f.path === path);

/** Starting value of a field's input before the user types anything. */
export function emptyValue(field: EditableField): unknown {
  if (field.kind === "enum[]") return [];
  if (field.kind === "production") return { value: "", min: "", max: "", basis: "stated" };
  if (field.kind === "speeds") return { fastest: "", slowest: "", bulb: false };
  return "";
}

/** Fields a new model needs at least. */
export const NEW_MODEL_REQUIRED = ["maker", "name"];

const SPEED = /^(1\/\d{1,5}|\d{1,2}(\.\d)?)$/;

/** One value, cleaned; throws a readable message when it doesn't fit. */
export function cleanValue(field: EditableField, value: unknown): unknown {
  const fail = (msg: string) => { throw new Error(`${field.label}: ${msg}`); };
  switch (field.kind) {
    case "year": {
      const y = Number(value);
      if (!Number.isInteger(y) || y < 1839 || y > new Date().getFullYear()) fail("a year between 1839 and now");
      return y;
    }
    case "text":
    case "alias": {
      const t = String(value ?? "").trim();
      if (!t) fail("can’t be empty");
      if (t.length > (field.max ?? 120)) fail(`at most ${field.max} characters`);
      if (field.path === "attributes.frame_size" && !/^\d+(\.\d+)?x\d+(\.\d+)?$/.test(t)) fail("like 24x36");
      return t;
    }
    case "enum":
      if (typeof value !== "string" || !(value in field.options!)) fail("pick one of the options");
      return value;
    case "enum[]": {
      const list = Array.isArray(value) ? [...new Set(value.map(String))] : [];
      if (!list.length || list.some((v) => !(v in field.options!))) fail("pick at least one option");
      return list;
    }
    case "production": {
      const p = (value ?? {}) as { value?: unknown; min?: unknown; max?: unknown; basis?: unknown };
      const n = (x: unknown) => (x === "" || x == null ? null : Number(x));
      const v = n(p.value), min = n(p.min), max = n(p.max);
      const ok = (x: number | null) => x === null || (Number.isInteger(x) && x > 0 && x < 1e9);
      if (![v, min, max].every(ok)) fail("whole numbers");
      if (v === null && (min === null || max === null)) fail("a figure, or a range from–to");
      if (v === null && min! > max!) fail("the range goes from smaller to larger");
      const basis = v === null ? "range" : p.basis === "estimate" ? "estimate" : "stated";
      return v === null ? { min, max, basis } : { value: v, basis };
    }
    case "speeds": {
      const s = (value ?? {}) as { fastest?: unknown; slowest?: unknown; bulb?: unknown };
      const fastest = String(s.fastest ?? "").trim();
      const slowest = String(s.slowest ?? "").trim();
      if (!SPEED.test(fastest)) fail("fastest like 1/1000");
      if (slowest && !SPEED.test(slowest)) fail("slowest like 1 or 1/30");
      return { fastest, ...(slowest ? { slowest } : {}), ...(s.bulb ? { bulb: true } : {}) };
    }
  }
}

/** All changes, cleaned: { path: value }. Unknown paths are refused. */
export function cleanChanges(changes: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(changes ?? {})) {
    const field = fieldByPath(path);
    if (!field) throw new Error(`Unknown field ${path}`);
    out[path] = cleanValue(field, value);
  }
  if (!Object.keys(out).length) throw new Error("Change at least one field");
  return out;
}

export type EditKind = "edit" | "new_model" | "merge";
export type EditStatus = "proposed" | "approved" | "rejected";

export type CatalogEditRow = {
  id: string;
  kind: EditKind;
  catalogId: string | null;
  catalogName: string | null;
  catalogPath: string | null;
  changes: Record<string, unknown>;
  /** Current values of the changed fields, for the moderator's diff. */
  current: Record<string, unknown>;
  mergeInto: { id: string; name: string; path: string } | null;
  source: string;
  note: string | null;
  status: EditStatus;
  reviewNote: string | null;
  author: string | null;
  createdAt: string;
  resultPath: string | null;
};

/** A value as one line of text, for diffs and lists. */
export function valueText(path: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const field = fieldByPath(path);
  if (field?.kind === "enum") return field.options![String(value)] ?? String(value);
  if (field?.kind === "enum[]" && Array.isArray(value)) return value.map((v) => field.options![v] ?? v).join(", ");
  if (field?.kind === "production" && typeof value === "object") {
    const p = value as { value?: number; min?: number; max?: number; basis?: string };
    const n = (x?: number) => x?.toLocaleString("en-US");
    return p.value != null ? `${n(p.value)} (${p.basis ?? "stated"})` : `${n(p.min)}–${n(p.max)}`;
  }
  if (field?.kind === "speeds" && typeof value === "object") {
    const s = value as { fastest?: string; slowest?: string; bulb?: boolean };
    return [s.slowest && `${s.slowest} s`, s.fastest && `${s.fastest} s`].filter(Boolean).join(" – ") + (s.bulb ? ", B" : "");
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}
