export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = itemId(event);
  const body = await readBody<Record<string, unknown>>(event);
  const fields = toColumns(parseCopy(body, true));
  if ("catalogId" in body) fields.catalog_id = await activeCatalogId(body.catalogId);
  const sql = useDb();
  const rows = Object.keys(fields).length
    ? await sql`update collection_items set ${sql(fields)}, updated_at = now()
        where id = ${id} and owner_id = ${user.id} and status <> 'wanted' returning id`
    : [{ id }];
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return (await listCopies(user.id, id))[0];
});
