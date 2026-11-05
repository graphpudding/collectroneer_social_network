// Unread messages across my conversations (header badge). Signed out: 0.
export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session) return { unread: 0 };
  const id = session.user.id;
  const [r] = await useDb()<{ n: number }[]>`
    select count(*)::int as n
    from conversations c join messages x on x.conversation_id = c.id
    where (c.user_a = ${id} or c.user_b = ${id}) and x.sender_id <> ${id} and x.deleted_at is null
      and x.created_at > case when c.user_a = ${id} then c.a_last_read_at else c.b_last_read_at end`;
  return { unread: r?.n ?? 0 };
});
