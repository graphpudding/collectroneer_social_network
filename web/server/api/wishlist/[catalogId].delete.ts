export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await useDb()`
    delete from collection_items
    where owner_id = ${user.id} and catalog_id = ${getRouterParam(event, "catalogId") ?? ""} and status = 'wanted'`;
  return { wanted: false };
});
