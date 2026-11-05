export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await useDb()`
    delete from user_blocks b using users u
    where b.blocker_id = ${user.id} and b.blocked_id = u.id and u.username = ${String(getRouterParam(event, "username")).toLowerCase()}`;
  return { blocked: false };
});
