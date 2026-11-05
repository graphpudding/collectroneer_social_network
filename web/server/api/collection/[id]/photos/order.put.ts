// New order of a copy's photos: body { ids } with every photo id once. The first is the cover.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = itemId(event);
  const { ids } = await readBody<{ ids?: string[] }>(event);
  const sql = useDb();
  const current = await sql<{ id: string }[]>`select id from copy_photos where item_id = ${id} and owner_id = ${user.id}`;
  const known = new Set(current.map((r) => r.id));
  if (!Array.isArray(ids) || ids.length !== known.size || !ids.every((x) => known.has(x)) || new Set(ids).size !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: "Send every photo id once" });
  }
  await sql`
    update copy_photos p set position = o.n
    from unnest(${sql.array(ids)}::uuid[]) with ordinality as o(id, n)
    where p.id = o.id and p.item_id = ${id}`;
  return (await listCopies(user.id, id))[0]!.photos;
});
