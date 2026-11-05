import { randomUUID } from "node:crypto";
import { MAX_PHOTOS } from "#shared/collection";

// One photo per request (multipart field "file"), so the client shows progress per photo.
// New photos wait for review; the first photo becomes the cover.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = itemId(event);
  const sql = useDb();
  const [item] = await sql<{ n: number }[]>`
    select (select count(*)::int from copy_photos p where p.item_id = i.id) as n
    from collection_items i where i.id = ${id} and i.owner_id = ${user.id} and i.status <> 'wanted'`;
  if (!item) throw createError({ statusCode: 404, statusMessage: "Not found" });
  if (item.n >= MAX_PHOTOS) throw createError({ statusCode: 400, statusMessage: `Up to ${MAX_PHOTOS} photos per copy` });

  const photo = await processCopyPhoto(await readUpload(event));
  const base = `copies/${user.id}/${id}/${randomUUID()}`;
  const keys = { full: `${base}.webp`, thumb: `${base}-t.webp` };
  await putFile(keys.full, photo.full, "image/webp");
  await putFile(keys.thumb, photo.thumb, "image/webp");
  await sql`
    insert into copy_photos (item_id, owner_id, position, key_full, key_thumb, width, height)
    values (${id}, ${user.id}, ${item.n}, ${keys.full}, ${keys.thumb}, ${photo.width}, ${photo.height})`;
  return (await listCopies(user.id, id))[0]!.photos;
});
