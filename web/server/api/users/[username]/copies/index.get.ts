// A collector's public copies; ?status= filters.
export default defineEventHandler(async (event) => {
  const username = String(getRouterParam(event, "username")).toLowerCase();
  const user = await openUser(username);
  if (!user) throw createError({ statusCode: 404, statusMessage: "No such collector" });
  if (user.is_private) return [];
  const status = getQuery(event).status;
  return publicCopies({ ownerUsername: username, status: typeof status === "string" && status !== "all" ? status : undefined });
});
