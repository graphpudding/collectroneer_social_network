// Users I blocked, for settings; ?username= checks one.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const one = getQuery(event).username;
  const sql = useDb();
  return sql<{ username: string; blockedAt: string }[]>`
    select u.username, b.created_at as "blockedAt" from user_blocks b join users u on u.id = b.blocked_id
    where b.blocker_id = ${user.id} ${typeof one === "string" ? sql`and u.username = ${one.toLowerCase()}` : sql``}
    order by b.created_at desc`;
});
