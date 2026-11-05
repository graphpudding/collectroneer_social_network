import type { ConversationDetail } from "#shared/chat";

// A thread: the latest 50 messages, or ?before=<id> for older, ?after=<id> for newer.
export default defineEventHandler(async (event): Promise<ConversationDetail> => {
  const me = await requireUser(event);
  const { c, side, otherId } = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  const q = getQuery(event);
  const sql = useDb();
  const [other] = await sql<any[]>`select id, username, name, image from users where id = ${otherId}`;
  const { messages, hasMore } = await loadMessages(c.id, me.id, {
    before: typeof q.before === "string" ? q.before : undefined,
    after: typeof q.after === "string" ? q.after : undefined,
  });
  const otherRead = side === "a" ? c.b_last_read_at : c.a_last_read_at;
  return {
    id: c.id,
    other,
    item: await chatItem(c.item_id, me.id),
    messages,
    hasMore,
    otherReadAt: otherRead && !String(otherRead).includes("infinity") ? otherRead : null,
    blocked: await blockState(me.id, otherId),
    archived: side === "a" ? c.a_archived : c.b_archived,
  };
});
