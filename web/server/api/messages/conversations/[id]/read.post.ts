// Marks the thread read up to now and lets the other side show "Seen".
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const { c, side, otherId } = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  const sql = useDb();
  await sql`update conversations set ${side === "a" ? sql`a_last_read_at` : sql`b_last_read_at`} = now() where id = ${c.id}`;
  await publishChat([me.id, otherId], { type: "read", conversationId: c.id, from: me.id });
  return { ok: true };
});
