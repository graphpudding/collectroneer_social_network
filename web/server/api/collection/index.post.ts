// Adds a copy. Adding a copy of a wanted model takes it off the wishlist.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<Record<string, unknown>>(event);
  const catalogId = await activeCatalogId(body.catalogId);
  const fields = parseCopy(body, false);
  const sql = useDb();
  const id = await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into collection_items ${tx({ owner_id: user.id, catalog_id: catalogId, ...toColumns(fields) })}
      returning id`;
    await tx`delete from collection_items
      where owner_id = ${user.id} and catalog_id = ${catalogId} and status = 'wanted'`;
    return row!.id;
  });
  return (await listCopies(user.id, id))[0];
});
