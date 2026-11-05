export default defineEventHandler(async (event) => {
  const username = String(getRouterParam(event, "username")).toLowerCase();
  const [copy] = await publicCopies({ ownerUsername: username, id: itemId(event) });
  if (!copy) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return copy;
});
