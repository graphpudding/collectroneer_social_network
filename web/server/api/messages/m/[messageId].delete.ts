// Delete my own message for both sides; an attached photo is removed from storage.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const sql = useDb();
  const [m] = await sql<{ conversation_id: string; attachment_key: string | null; attachment_thumb: string | null }[]>`
    with old as (select * from messages where id = ${getRouterParam(event, "messageId") ?? ""} and sender_id = ${me.id} and deleted_at is null)
    update messages m set deleted_at = now(), body = null, attachment_key = null, attachment_thumb = null, item_id = null
    from old where m.id = old.id
    returning old.conversation_id, old.attachment_key, old.attachment_thumb`;
  if (!m) throw createError({ statusCode: 404, statusMessage: "Not found" });
  await deleteFiles([m.attachment_key, m.attachment_thumb].filter(Boolean) as string[]);
  const { otherId } = await memberConversation(m.conversation_id, me.id);
  await publishChat([me.id, otherId], { type: "update", conversationId: m.conversation_id, from: me.id });
  return { ok: true };
});
