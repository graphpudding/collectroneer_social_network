// Removes a copy and its photo files.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = itemId(event);
  const [own] = await useDb()`select 1 from collection_items where id = ${id} and owner_id = ${user.id}`;
  if (!own) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const keys = await photoKeys({ itemId: id });
  await useDb()`delete from collection_items where id = ${id}`;
  await deleteFiles(keys);
  return { deleted: true };
});
