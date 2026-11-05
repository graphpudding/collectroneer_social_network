import { randomUUID } from "node:crypto";

// Send a photo (multipart "file"): metadata stripped like copy photos.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event);
  const conv = await memberConversation(getRouterParam(event, "id") ?? "", me.id);
  await assertCanSend(me.id, conv.otherId);
  await checkRate(me.id, "message");
  const photo = await processCopyPhoto(await readUpload(event));
  const base = `messages/${conv.c.id}/${randomUUID()}`;
  await putFile(`${base}.webp`, photo.full, "image/webp");
  await putFile(`${base}-t.webp`, photo.thumb, "image/webp");
  const id = await sendMessage(conv, me.id, {
    attachment: { key: `${base}.webp`, thumb: `${base}-t.webp`, width: photo.width, height: photo.height },
  });
  return { id };
});
