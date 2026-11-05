// Everything stored about the signed-in user, as one JSON file (GDPR access request).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const sql = useDb();
  const [profile] = await sql`
    select id, username, name, email, bio, city, is_private, created_at from users where id = ${user.id}`;
  const logins = await sql`select provider_id, created_at from accounts where user_id = ${user.id}`;
  setHeader(event, "Content-Disposition", `attachment; filename="collectors-note-${profile?.username ?? "account"}.json"`);
  return { exported_at: new Date().toISOString(), profile, logins };
});
