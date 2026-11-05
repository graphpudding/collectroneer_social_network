// Deletes the account and everything that belongs to it (foreign keys cascade).
// The body must repeat the username, so a stray request cannot do it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const { confirm } = await readBody<{ confirm?: string }>(event);
  const me = await meById(user.id);
  const expected = me?.username ?? me?.email;
  if (!confirm || confirm.trim().toLowerCase() !== expected?.toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: "Type your username to confirm" });
  }
  const keys = [...(await photoKeys({ ownerId: user.id })), ...(me?.image ? [avatarKey(me.image)].filter(Boolean) as string[] : [])];
  await useDb()`delete from users where id = ${user.id}`;
  await deleteFiles(keys);
  return { deleted: true };
});
