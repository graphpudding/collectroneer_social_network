// "Typing…": nothing stored, just pushed to the other side.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const { c, otherId } = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  if (!(await blockState(me.id, otherId))) await publishChat([otherId], { type: "typing", conversationId: c.id, from: me.id });
  return { ok: true };
});
