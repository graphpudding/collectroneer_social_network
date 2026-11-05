import { MESSAGE_MAX } from "#shared/chat";

// Edit my own text message: body { body }.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const { body } = await readBody<{ body?: string }>(event);
  const text = String(body ?? "").trim();
  if (!text || text.length > MESSAGE_MAX) throw createError({ statusCode: 400, statusMessage: "Write something shorter" });
  const sql = useDb();
  const [m] = await sql<{ conversation_id: string }[]>`
    update messages set body = ${text}, edited_at = now()
    where id = ${getRouterParam(event, "messageId") ?? ""} and sender_id = ${me.id} and deleted_at is null and body is not null
    returning conversation_id`;
  if (!m) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const { otherId } = await memberConversation(m.conversation_id, me.id);
  await publishChat([me.id, otherId], { type: "update", conversationId: m.conversation_id, from: me.id });
  return { ok: true };
});
