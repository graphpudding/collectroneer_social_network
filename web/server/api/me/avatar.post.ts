import { randomUUID } from "node:crypto";

// Profile picture: square 400px WebP. Replaces (and deletes) the previous one.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const data = await processAvatar(await readUpload(event));
  const key = `avatars/${user.id}/${randomUUID()}.webp`;
  await putFile(key, data, "image/webp");
  const sql = useDb();
  const [old] = await sql<{ image: string | null }[]>`select image from users where id = ${user.id}`;
  await sql`update users set image = ${publicUrl(key)}, updated_at = now() where id = ${user.id}`;
  const oldKey = old?.image ? avatarKey(old.image) : null;
  if (oldKey) await deleteFiles([oldKey]);
  return meById(user.id);
});
