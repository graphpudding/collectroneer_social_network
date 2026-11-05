import type { ModelOwners } from "#shared/collection";

// Owners of a model, its variants included (SPEC section 5). Counts include copies that are not
// public, without saying whose; the list shows public copies only.
export default defineEventHandler(async (event): Promise<ModelOwners> => {
  const id = getRouterParam(event, "catalogId") ?? "";
  const sql = useDb();
  const variants = await sql<{ from_id: string }[]>`
    select from_id from catalog_relations where to_id = ${id} and relation = 'variant_of'`;
  const ids = [id, ...variants.map((v) => v.from_id)];
  const [counts] = await sql<{ owners: number; wanted: number }[]>`
    select
      count(distinct i.owner_id) filter (where i.status in ('owned', 'for_trade', 'for_sale'))::int as owners,
      count(distinct i.owner_id) filter (where i.status = 'wanted')::int as wanted
    from collection_items i join users u on u.id = i.owner_id
    where i.catalog_id = any(${sql.array(ids)}::text[]) and not u.banned`;
  return { owners: counts!.owners, wanted: counts!.wanted, copies: await publicCopies({ catalogIds: ids, limit: 24, viewerId: (await getAuthSession(event))?.user.id }) };
});
