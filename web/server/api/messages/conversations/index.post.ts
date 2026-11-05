// Opens the conversation with a user (creating it on first contact). Body { to: username, itemId? }.
// With itemId the conversation is "about" that copy, shown as a card on top of the thread.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const { to, itemId } = await readBody<{ to?: string; itemId?: string }>(event);
  const sql = useDb();
  const [other] = await sql<{ id: string; is_private: boolean; banned: boolean }[]>`
    select id, is_private, banned from users where username = ${String(to ?? "").toLowerCase()}`;
  if (!other || other.banned) throw createError({ statusCode: 404, statusMessage: "No such collector" });
  if (other.id === me.id) throw createError({ statusCode: 400, statusMessage: "That’s you" });
  const [a, b] = [me.id, other.id].sort();
  const [existing] = await sql<{ id: string }[]>`select id from conversations where user_a = ${a!} and user_b = ${b!}`;
  const item = itemId ? await chatItem(itemId, me.id) : null;
  if (existing) {
    if (item) await sql`update conversations set item_id = ${item.id} where id = ${existing.id}`;
    return { id: existing.id };
  }
  await assertCanSend(me.id, other.id);
  if (other.is_private) throw createError({ statusCode: 403, statusMessage: "This collector has a closed account" });
  await checkRate(me.id, "conversation");
  const [row] = await sql<{ id: string }[]>`
    insert into conversations (user_a, user_b, item_id) values (${a!}, ${b!}, ${item?.id ?? null})
    on conflict (user_a, user_b) do update set item_id = coalesce(excluded.item_id, conversations.item_id)
    returning id`;
  return { id: row!.id };
});
