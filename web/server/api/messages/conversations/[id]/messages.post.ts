import { MESSAGE_MAX } from "#shared/chat";

// Send a text message, optionally with a copy card: body { body?, itemId? }.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const conv = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  const { body, itemId } = await readBody<{ body?: string; itemId?: string }>(event);
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > MESSAGE_MAX) throw createError({ statusCode: 400, statusMessage: `At most ${MESSAGE_MAX} characters` });
  const item = itemId ? await chatItem(itemId, me.id) : null;
  if (!text && !item) throw createError({ statusCode: 400, statusMessage: "Write something" });
  await assertCanSend(me.id, conv.otherId);
  await checkRate(me.id, "message");
  const id = await sendMessage(conv, me.id, { body: text || null, itemId: item?.id ?? null });
  return { id };
});
