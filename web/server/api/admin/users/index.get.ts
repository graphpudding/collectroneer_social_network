import type { AdminUser } from "#shared/admin";

// Find users by username or email; newest first.
export default defineEventHandler(async (event): Promise<AdminUser[]> => {
  await requireAdmin(event);
  const q = String(getQuery(event).q ?? "").trim().toLowerCase();
  const sql = useDb();
  return sql<AdminUser[]>`
    select u.id, u.username, u.email, u.role, u.banned, u.ban_reason as "banReason", u.is_private as "isPrivate",
      u.created_at as "createdAt",
      (select count(*)::int from collection_items i where i.owner_id = u.id and i.status <> 'wanted') as copies,
      (select count(*)::int from reports r where r.target_user_id = u.id) as reports
    from users u
    ${q ? sql`where u.username like ${"%" + q + "%"} or lower(u.email) like ${"%" + q + "%"}` : sql``}
    order by u.created_at desc
    limit 50`;
});
