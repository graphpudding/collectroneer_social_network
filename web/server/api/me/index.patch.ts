import { BIO_MAX, CITY_MAX, NAME_MAX, usernameProblem } from "#shared/account";

type Body = { username?: string; name?: string; bio?: string; city?: string; isPrivate?: boolean };

const text = (v: unknown, max: number) => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > max) throw createError({ statusCode: 400, statusMessage: `At most ${max} characters` });
  return t || null;
};

// Profile edits. Username: same rules as sign-up, unique, stored lowercase.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<Body>(event);
  const sql = useDb();
  const patch: Record<string, unknown> = {};

  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    const problem = usernameProblem(username);
    if (problem) throw createError({ statusCode: 400, statusMessage: problem });
    const [taken] = await sql`select 1 from users where username = ${username} and id <> ${user.id}`;
    if (taken) throw createError({ statusCode: 409, statusMessage: "This name is taken" });
    patch.username = username;
    patch.display_username = username;
  }
  const name = text(body.name, NAME_MAX);
  if (name !== undefined) patch.name = name ?? "";
  const bio = text(body.bio, BIO_MAX);
  if (bio !== undefined) patch.bio = bio;
  const city = text(body.city, CITY_MAX);
  if (city !== undefined) patch.city = city;
  if (typeof body.isPrivate === "boolean") patch.is_private = body.isPrivate;

  if (Object.keys(patch).length) {
    await sql`update users set ${sql(patch)}, updated_at = now() where id = ${user.id}`;
  }
  return meById(user.id);
});
