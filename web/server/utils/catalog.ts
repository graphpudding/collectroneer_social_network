import type { PendingQuery, Row } from "postgres";
import {
  MAX_LIMIT,
  type CatalogCard,
  type CatalogDetail,
  type CatalogEntry,
  type CatalogList,
  type FacetValue,
  type Section,
  type Sort,
} from "#shared/catalog";
import { rateRarity, type RarityLevel } from "#shared/rarity";

const CARD_COLUMNS = ["id", "name", "maker", "year_start", "year_end", "country", "image_url", "attributes"];
const ENTRY_COLUMNS = [
  "id", "status", "merged_into", "category", "name", "maker", "labels", "aliases",
  "year_start", "year_end", "country", "production_count", "attributes",
  "image_url", "image_license", "image_author", "external_ids", "source_urls",
  "field_sources", "data_license", "attribution", "match_confidence", "notes",
];

export type ListParams = {
  q: string;
  limit: number;
  offset: number;
  sort: Sort;
  filters: Record<string, string[]>; // filter key -> selected values, OR within a key
};

type Fragment = PendingQuery<Row[]>;

const and = (parts: Fragment[]) => {
  const sql = useDb();
  return parts.reduce((acc, p) => sql`${acc} and ${p}`);
};

/** Matches "Zenit-E", "zenit e", "зенит" and near misses; see search columns in the migration. */
function searchCondition(q: string): Fragment {
  const sql = useDb();
  return sql`(search_compact like '%' || catalog_compact(${q}) || '%' or search_text % lower(${q}))`;
}

function filterCondition(section: Section, key: string, values: string[]): Fragment | undefined {
  const sql = useDb();
  const filter = section.filters.find((f) => f.key === key);
  if (!filter || !values.length) return undefined;
  switch (filter.kind) {
    case "column":
      return sql`${sql(filter.key)} = any(${sql.array(values)}::text[])`;
    case "scalar":
      return sql`attributes ->> ${key} = any(${sql.array(values)}::text[])`;
    case "array":
      return sql`attributes -> ${key} ?| ${sql.array(values)}::text[]`;
    case "decade": {
      const decades = values.map((v) => Number.parseInt(v, 10)).filter(Number.isFinite);
      return sql`year_start / 10 * 10 = any(${sql.array(decades)}::int[])`;
    }
  }
}

function facetValues(section: Section, key: string): Fragment {
  const sql = useDb();
  const filter = section.filters.find((f) => f.key === key)!;
  if (filter.kind === "column") return sql`${sql(key)}`;
  if (filter.kind === "scalar") return sql`attributes ->> ${key}`;
  if (filter.kind === "decade") return sql`(year_start / 10 * 10)::text || 's'`;
  return sql`jsonb_array_elements_text(case jsonb_typeof(attributes -> ${key})
    when 'array' then attributes -> ${key} else '[]' end)`;
}

/** Card columns plus the parent model's name for the "Variant of" badge. */
function cardSelect(extra?: Fragment): Fragment {
  const sql = useDb();
  return sql`
    select ${sql(CARD_COLUMNS.map((c) => `e.${c}`))}, ${extra ?? sql`null`} as extra,
      (select p.name from catalog_relations r join catalog_entries p on p.id = r.to_id
       where r.from_id = e.id and r.relation = 'variant_of' limit 1) as variant_of_name
    from catalog_entries e
  `;
}

export async function listCatalog(section: Section, params: ListParams): Promise<CatalogList> {
  const sql = useDb();
  const base = [sql`category = ${section.category}`, sql`status = 'active'`];
  if (params.q) base.push(searchCondition(params.q));
  const conditions = (skip?: string) =>
    section.filters.flatMap((f) => {
      const cond = f.key === skip ? undefined : filterCondition(section, f.key, params.filters[f.key] ?? []);
      return cond ? [cond] : [];
    });

  const order = params.q
    ? sql`(search_compact like '%' || catalog_compact(${params.q}) || '%') desc,
          similarity(search_text, lower(${params.q})) desc, maker, name`
    : params.sort === "year"
      ? sql`year_start nulls last, maker, name`
      : sql`maker, name`;

  const limit = Math.min(Math.max(params.limit, 1), MAX_LIMIT);
  const rows = await sql<(CatalogCard & { extra: number })[]>`
    with found as (
      select id, count(*) over ()::int as total from catalog_entries
      where ${and([...base, ...conditions()])}
      order by ${order}
      limit ${limit} offset ${Math.max(params.offset, 0)}
    )
    ${cardSelect(sql`found.total`)} join found using (id)
    order by ${order}
  `;

  // Each facet counts with every other active filter but not its own, so picking a second
  // value within a group shows how many it would add.
  const facetRows = await Promise.all(
    section.filters.map(
      (f) => sql<FacetValue[]>`
        select v as value, count(*)::int as count
        from catalog_entries, lateral (select ${facetValues(section, f.key)} as v) t
        where ${and([...base, ...conditions(f.key)])} and v is not null
        group by v
        order by count desc, v
      `,
    ),
  );

  return {
    items: rows.map(({ extra: _, ...card }) => card),
    total: rows[0]?.extra ?? 0,
    facets: Object.fromEntries(section.filters.map((f, i) => [f.key, [...facetRows[i]!]])),
  };
}

export type DetailResult = { found: CatalogDetail } | { mergedInto: CatalogEntry } | null;

export async function getCatalogEntry(id: string): Promise<DetailResult> {
  const sql = useDb();
  const [entry] = await sql<CatalogEntry[]>`
    select ${sql(ENTRY_COLUMNS)} from catalog_entries where id = ${id}
  `;
  if (!entry || entry.status === "retired") return null;
  if (entry.status === "merged" && entry.merged_into) {
    const target = await getCatalogEntry(entry.merged_into);
    return target && "found" in target ? { mergedInto: target.found.entry } : target;
  }

  const cards = (ids: Fragment) => sql<(CatalogCard & { extra: null })[]>`
    ${cardSelect()}
    where e.id in ${ids} and e.status = 'active'
    order by e.year_start nulls last, e.name
  `;
  const [variantOf, variants, [scale]] = await Promise.all([
    cards(sql`(select to_id from catalog_relations where from_id = ${id} and relation = 'variant_of')`),
    cards(sql`(select from_id from catalog_relations where to_id = ${id} and relation = 'variant_of')`),
    sql<{ levels: RarityLevel[] }[]>`select levels from rarity_scales where category = ${entry.category}`,
  ]);
  const strip = (rows: (CatalogCard & { extra: null })[]) => rows.map(({ extra: _, ...c }) => c);
  // A variant is rated on its own production only: a special edition can be far rarer than its base.
  const rarity = scale ? rateRarity(scale.levels, entry.production_count) : null;
  return { found: { entry, rarity, variantOf: strip(variantOf), variants: strip(variants) } };
}
