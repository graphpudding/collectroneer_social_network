import { cleanChanges, NEW_MODEL_REQUIRED, type CatalogEditRow } from "#shared/edits";
import { entryPath } from "#shared/catalog";

import type { TransactionSql } from "postgres";

type Tx = TransactionSql<Record<string, unknown>>;
const TOP_COLUMNS = new Set(["maker", "name", "year_start", "year_end", "country", "production_count"]);
/** Licence of what users add to the catalog (stated in the terms). */
export const USER_DATA_LICENSE = "CC BY-SA 4.0";
export const USER_ATTRIBUTION = "Collectors Note contributors, CC BY-SA 4.0";

const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s);

/** Validates a suggestion body; returns what to store. */
export async function parseSuggestion(body: Record<string, any>) {
  const kind = body.kind;
  if (!["edit", "new_model", "merge"].includes(kind)) throw createError({ statusCode: 400, statusMessage: "Unknown kind" });
  const source = String(body.source ?? "").trim();
  if (source.length < 3 || source.length > 500) {
    throw createError({ statusCode: 400, statusMessage: "Say where this comes from: a link, a book, or your own copy" });
  }
  const note = String(body.note ?? "").trim().slice(0, 1000) || null;
  const sql = useDb();
  const entry = async (id: unknown) => {
    const [e] = await sql<{ id: string; category: string; status: string }[]>`
      select id, category, status from catalog_entries where id = ${String(id ?? "")}`;
    if (!e || e.status !== "active") throw createError({ statusCode: 404, statusMessage: "No such model" });
    return e;
  };
  try {
    if (kind === "merge") {
      const dup = await entry(body.catalogId);
      const into = await entry(body.changes?.into);
      if (dup.id === into.id || dup.category !== into.category) throw new Error("Pick a different model of the same kind");
      return { kind, catalogId: dup.id, category: dup.category, changes: { into: into.id }, source, note };
    }
    const changes = cleanChanges(body.changes ?? {});
    if (kind === "new_model") {
      const missing = NEW_MODEL_REQUIRED.filter((p) => !(p in changes));
      if (missing.length) throw new Error("A new model needs at least the maker and the model name");
      return { kind, catalogId: null, category: "film_cameras", changes, source, note };
    }
    const e = await entry(body.catalogId);
    return { kind, catalogId: e.id, category: e.category, changes, source, note };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 400, statusMessage: err.message });
  }
}

/** Applies an approved suggestion inside a transaction. Returns the new record id for new models. */
export async function applyEdit(tx: Tx, edit: { id: string; kind: string; catalog_id: string | null; category: string; changes: any; source: string; note: string | null }) {
  const mark = `user_edit:${edit.id}`;
  const url = isUrl(edit.source) ? [edit.source] : [];

  if (edit.kind === "merge") {
    await tx`update catalog_entries set status = 'merged', merged_into = ${edit.changes.into} where id = ${edit.catalog_id!}`;
    await tx`update collection_items set catalog_id = ${edit.changes.into} where catalog_id = ${edit.catalog_id!}`;
    return null;
  }

  const changes = edit.changes as Record<string, unknown>;
  const withSource = (path: string, v: unknown) =>
    path === "production_count" ? { ...(v as object), source: { url: url[0] ?? null, quote: url.length ? edit.note : edit.source } } : v;

  if (edit.kind === "new_model") {
    const [seq] = await tx<{ next: number }[]>`
      select coalesce(max(split_part(id, ':', 2)::int), 0) + 1 as next from catalog_entries where category = ${edit.category}`;
    const id = `${edit.category}:${String(seq!.next).padStart(6, "0")}`;
    const attributes: Record<string, unknown> = {};
    const row: Record<string, unknown> = {};
    for (const [path, v] of Object.entries(changes)) {
      if (path.startsWith("attributes.")) attributes[path.slice(11)] = v;
      else if (path === "aliases") row.aliases = [v];
      else row[path] = withSource(path, v);
    }
    await tx`
      insert into catalog_entries ${tx({
        id, category: edit.category, ...row, attributes: tx.json(attributes as any),
        production_count: row.production_count ? tx.json(row.production_count as any) : null,
        labels: tx.json({ en: `${row.maker} ${row.name}` }),
        field_sources: tx.json(Object.fromEntries(Object.keys(changes).map((p) => [p, mark]))),
        source_urls: url, data_license: USER_DATA_LICENSE, attribution: [USER_ATTRIBUTION],
        match_confidence: "user",
      } as any)}`;
    return id;
  }

  // A field edit.
  for (const [path, v] of Object.entries(changes)) {
    if (path === "aliases") {
      await tx`update catalog_entries set aliases = case when ${v as string} = any(aliases) then aliases else array_append(aliases, ${v as string}) end where id = ${edit.catalog_id!}`;
    } else if (path.startsWith("attributes.")) {
      await tx`update catalog_entries set attributes = jsonb_set(attributes, ${[path.slice(11)]}, ${tx.json(v as any)}) where id = ${edit.catalog_id!}`;
    } else if (TOP_COLUMNS.has(path)) {
      const value = withSource(path, v);
      await tx`update catalog_entries set ${tx(path)} = ${path === "production_count" ? tx.json(value as any) : (value as any)} where id = ${edit.catalog_id!}`;
    }
  }
  await tx`
    update catalog_entries set
      field_sources = field_sources || ${tx.json(Object.fromEntries(Object.keys(changes).map((p) => [p, mark])))},
      source_urls = (select array(select distinct unnest(source_urls || ${url}::text[]))),
      attribution = case when ${USER_ATTRIBUTION} = any(attribution) then attribution else array_append(attribution, ${USER_ATTRIBUTION}) end
    where id = ${edit.catalog_id!}`;
  return null;
}

const getPath = (e: any, path: string) => (path.startsWith("attributes.") ? e?.attributes?.[path.slice(11)] : e?.[path]);

/** Suggestions with the current values next to the proposed ones. */
export async function listEdits(where: { status?: string; userId?: string }): Promise<CatalogEditRow[]> {
  const sql = useDb();
  const rows = await sql<any[]>`
    select c.*, u.username as author,
      to_jsonb(e) as entry, to_jsonb(t) as into_entry, to_jsonb(r) as result_entry
    from catalog_edits c
    left join users u on u.id = c.user_id
    left join catalog_entries e on e.id = c.catalog_id
    left join catalog_entries t on t.id = c.changes->>'into'
    left join catalog_entries r on r.id = c.result_catalog_id
    where true
      ${where.status === "proposed" ? sql`and c.status = 'proposed'` : where.status ? sql`and c.status <> 'proposed'` : sql``}
      ${where.userId ? sql`and c.user_id = ${where.userId}` : sql``}
    order by c.created_at ${where.status === "proposed" ? sql`asc` : sql`desc`}
    limit 100`;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, catalogId: r.catalog_id,
    catalogName: r.entry ? `${r.entry.maker} ${r.entry.name}` : null,
    catalogPath: r.entry ? entryPath(r.entry) : null,
    changes: r.changes,
    current: r.kind === "edit" ? Object.fromEntries(Object.keys(r.changes).map((p) => [p, getPath(r.entry, p) ?? null])) : {},
    mergeInto: r.into_entry ? { id: r.into_entry.id, name: `${r.into_entry.maker} ${r.into_entry.name}`, path: entryPath(r.into_entry) } : null,
    source: r.source, note: r.note, status: r.status, reviewNote: r.review_note, author: r.author, createdAt: r.created_at,
    resultPath: r.result_entry ? entryPath(r.result_entry) : null,
  }));
}
