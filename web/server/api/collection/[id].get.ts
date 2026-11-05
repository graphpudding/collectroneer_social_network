// One of my copies, for the editor.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const [copy] = await listCopies(user.id, itemId(event));
  if (!copy) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return copy;
});
