import type { PublicProfile } from "#shared/account";

export default defineEventHandler(async (event): Promise<PublicProfile> => {
  const username = String(getRouterParam(event, "username")).toLowerCase();
  const sql = useDb();
  const [u] = await sql<any[]>`
    select id, username, name, image, bio, city, is_private, created_at
    from users where username = ${username} and not banned`;
  if (!u) throw createError({ statusCode: 404, statusMessage: "No such collector" });
  const base = { username: u.username, name: u.name, image: u.image, joinedAt: u.created_at };
  if (u.is_private) return { ...base, bio: null, city: null, closed: true, counts: { copies: 0, wishlist: 0, byStatus: {} } };
  const copies = await publicCopies({ ownerUsername: username });
  const byStatus: Record<string, number> = {};
  for (const c of copies) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  const [wish] = await sql<{ n: number }[]>`
    select count(*)::int as n from collection_items where owner_id = ${u.id} and status = 'wanted'`;
  return { ...base, bio: u.bio, city: u.city, closed: false, counts: { copies: copies.length, wishlist: wish?.n ?? 0, byStatus } };
});
