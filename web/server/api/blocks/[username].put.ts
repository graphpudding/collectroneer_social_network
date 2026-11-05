// Block a user: they can't message you, and you stop seeing each other in owner lists.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const sql = useDb();
  const [target] = await sql<{ id: string }[]>`select id from users where username = ${String(getRouterParam(event, "username")).toLowerCase()}`;
  if (!target) throw createError({ statusCode: 404, statusMessage: "No such user" });
  if (target.id === user.id) throw createError({ statusCode: 400, statusMessage: "That’s you" });
  await sql`insert into user_blocks (blocker_id, blocked_id) values (${user.id}, ${target.id}) on conflict do nothing`;
  return { blocked: true };
});
