// The signed-in user, or null.
export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  return session ? await meById(session.user.id) : null;
});
