import type { H3Event } from "h3";
import {
  CONDITIONS, COPY_STATUSES, LIMITS, VISIBILITIES,
  type CollectionItem, type CopyFields, type CopyPhoto, type PhotoStatus, type WishlistItem,
} from "#shared/collection";

/** Validates a copy form; unknown keys are ignored. */
export function parseCopy(body: Record<string, unknown>, partial: boolean): Partial<CopyFields> {
  const out: Partial<CopyFields> = {};
  const bad = (msg: string) => createError({ statusCode: 400, statusMessage: msg });
  const text = (key: keyof typeof LIMITS, field: keyof CopyFields) => {
    if (!(field in body)) return;
    const v = body[field];
    if (v === null || v === "") return void ((out as any)[field] = null);
    if (typeof v !== "string") throw bad(`${field} must be text`);
    const t = v.trim();
    if (t.length > LIMITS[key]) throw bad(`${field}: at most ${LIMITS[key]} characters`);
    (out as any)[field] = t || null;
  };
  if ("status" in body || !partial) {
    if (!COPY_STATUSES.includes(body.status as never)) throw bad("Unknown status");
    out.status = body.status as CopyFields["status"];
  }
  text("edition", "edition");
  text("serial", "serialNumber");
  text("acquired", "acquired");
  text("note", "note");
  if ("hideSerial" in body) out.hideSerial = Boolean(body.hideSerial);
  if ("condition" in body) {
    if (body.condition !== null && !CONDITIONS.includes(body.condition as never)) throw bad("Unknown condition");
    out.condition = (body.condition as CopyFields["condition"]) ?? null;
  }
  if ("visibility" in body) {
    if (!VISIBILITIES.includes(body.visibility as never)) throw bad("Unknown visibility");
    out.visibility = body.visibility as CopyFields["visibility"];
  }
  return out;
}

export const COPY_COLUMNS = {
  status: "status", edition: "edition", serialNumber: "serial_number", hideSerial: "hide_serial",
  condition: "condition", acquired: "acquired", note: "note", visibility: "visibility",
} as const satisfies Record<keyof CopyFields, string>;

export function toColumns(fields: Partial<CopyFields>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [COPY_COLUMNS[k as keyof CopyFields], v]),
  );
}

/** A catalog card as JSON, for joins: matches CatalogCard. */
const modelJson = (sql: ReturnType<typeof useDb>) => sql`
  json_build_object(
    'id', e.id, 'category', e.category, 'name', e.name, 'maker', e.maker, 'year_start', e.year_start, 'year_end', e.year_end,
    'country', e.country, 'image_url', e.image_url, 'attributes', e.attributes, 'variant_of_name', null
  )`;

type PhotoRow = { id: string; status: PhotoStatus; reject_reason: string | null; key_full: string; key_thumb: string; width: number; height: number };

/** Photo rows (as JSON from a join) -> what the client sees. */
export const toPhotos = (rows: PhotoRow[] | null): CopyPhoto[] =>
  (rows ?? []).map((p) => ({
    id: p.id, status: p.status, rejectReason: p.reject_reason, width: p.width, height: p.height,
    thumbUrl: publicUrl(p.key_thumb), fullUrl: publicUrl(p.key_full),
  }));

/** Photos of each copy as a JSON array, in order; approvedOnly for other people's eyes. */
export const photosJson = (sql: ReturnType<typeof useDb>, approvedOnly: boolean) => sql`
  coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'status', p.status, 'reject_reason', p.reject_reason, 'key_full', p.key_full,
      'key_thumb', p.key_thumb, 'width', p.width, 'height', p.height) order by p.position, p.created_at)
    from copy_photos p
    where p.item_id = i.id ${approvedOnly ? sql`and p.status = 'approved'` : sql``}
  ), '[]'::json)`;

export async function listCopies(ownerId: string, id?: string): Promise<CollectionItem[]> {
  const sql = useDb();
  const rows = await sql<(Omit<CollectionItem, "photos"> & { photos: PhotoRow[] })[]>`
    select i.id, i.catalog_id as "catalogId", i.status, i.edition, i.serial_number as "serialNumber",
      i.hide_serial as "hideSerial", i.condition, i.acquired, i.note, i.visibility,
      i.created_at as "createdAt", i.updated_at as "updatedAt", ${modelJson(sql)} as model,
      ${photosJson(sql, false)} as photos
    from collection_items i join catalog_entries e on e.id = i.catalog_id
    where i.owner_id = ${ownerId} and i.status <> 'wanted' ${id ? sql`and i.id = ${id}` : sql``}
    order by i.created_at desc`;
  return rows.map((r) => ({ ...r, photos: toPhotos(r.photos) }));
}

/** Storage keys of every photo of these copies (or of a whole owner), for cleanup. */
export async function photoKeys(where: { itemId?: string; ownerId?: string }) {
  const sql = useDb();
  const rows = await sql<{ key_full: string; key_thumb: string }[]>`
    select key_full, key_thumb from copy_photos
    where ${where.itemId ? sql`item_id = ${where.itemId}` : sql`owner_id = ${where.ownerId!}`}`;
  return rows.flatMap((r) => [r.key_full, r.key_thumb]);
}

export async function listWishlist(ownerId: string): Promise<WishlistItem[]> {
  const sql = useDb();
  return sql<WishlistItem[]>`
    select i.id, i.catalog_id as "catalogId", i.created_at as "createdAt", ${modelJson(sql)} as model
    from collection_items i join catalog_entries e on e.id = i.catalog_id
    where i.owner_id = ${ownerId} and i.status = 'wanted'
    order by i.created_at desc`;
}

/** The model must exist and be active (merged records point elsewhere). */
export async function activeCatalogId(id: unknown) {
  if (typeof id !== "string") throw createError({ statusCode: 400, statusMessage: "Pick a model" });
  const [row] = await useDb()<{ id: string; status: string; merged_into: string | null }[]>`
    select id, status, merged_into from catalog_entries where id = ${id}`;
  if (!row || row.status === "retired") throw createError({ statusCode: 404, statusMessage: "No such model" });
  return row.status === "merged" ? row.merged_into! : row.id;
}

export function itemId(event: H3Event) {
  const id = getRouterParam(event, "id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return id;
}
