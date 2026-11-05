// "I want this": idempotent.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const catalogId = await activeCatalogId(getRouterParam(event, "catalogId"));
  await useDb()`
    insert into collection_items (owner_id, catalog_id, status) values (${user.id}, ${catalogId}, 'wanted')
    on conflict (owner_id, catalog_id) where status = 'wanted' do nothing`;
  return { wanted: true };
});
