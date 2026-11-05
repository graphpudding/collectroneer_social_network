export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = itemId(event);
  const sql = useDb();
  const [row] = await sql<{ key_full: string; key_thumb: string }[]>`
    delete from copy_photos
    where id = ${getRouterParam(event, "photoId") ?? ""} and item_id = ${id} and owner_id = ${user.id}
    returning key_full, key_thumb`;
  if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });
  await deleteFiles([row.key_full, row.key_thumb]);
  // Close the gap so the order stays 0..n-1.
  await sql`
    update copy_photos p set position = o.n
    from (select id, row_number() over (order by position, created_at) - 1 as n from copy_photos where item_id = ${id}) o
    where p.id = o.id`;
  return (await listCopies(user.id, id))[0]!.photos;
});
