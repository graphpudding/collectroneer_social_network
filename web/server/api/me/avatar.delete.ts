export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const sql = useDb();
  const [old] = await sql<{ image: string | null }[]>`select image from users where id = ${user.id}`;
  await sql`update users set image = null, updated_at = now() where id = ${user.id}`;
  const oldKey = old?.image ? avatarKey(old.image) : null;
  if (oldKey) await deleteFiles([oldKey]);
  return meById(user.id);
});
