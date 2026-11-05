// Archive or restore a thread for me only: body { archived }. A new message brings it back.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const { c, side } = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  const { archived } = await readBody<{ archived?: boolean }>(event);
  const sql = useDb();
  await sql`update conversations set ${side === "a" ? sql`a_archived` : sql`b_archived`} = ${Boolean(archived)} where id = ${c.id}`;
  return { archived: Boolean(archived) };
});
