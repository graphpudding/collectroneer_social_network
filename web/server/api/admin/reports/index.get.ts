import type { ReportRow } from "#shared/admin";

export default defineEventHandler(async (event): Promise<ReportRow[]> => {
  await requireModerator(event);
  const status = getQuery(event).status === "closed" ? "closed" : "open";
  const sql = useDb();
  const rows = await sql<any[]>`
    select r.*, t.username as target_username, t.banned as target_banned, rep.username as reporter_username,
      (select i.id from collection_items i where r.target_type = 'copy' and i.id::text = r.target_id) as copy_id,
      (select i.id from copy_photos p join collection_items i on i.id = p.item_id
         where r.target_type = 'photo' and p.id::text = r.target_id) as photo_copy_id
    from reports r
    left join users t on t.id = r.target_user_id
    left join users rep on rep.id = r.reporter_id
    where ${status === "open" ? sql`r.status = 'open'` : sql`r.status <> 'open'`}
    order by r.created_at ${status === "open" ? sql`asc` : sql`desc`}
    limit 100`;
  return rows.map((r) => {
    const copyId = r.copy_id ?? r.photo_copy_id;
    return {
      id: r.id, targetType: r.target_type, targetId: r.target_id,
      targetUser: r.target_user_id ? { id: r.target_user_id, username: r.target_username, banned: r.target_banned } : null,
      reporter: r.reporter_username, reason: r.reason, details: r.details, status: r.status,
      resolution: r.resolution, createdAt: r.created_at,
      link: r.target_username ? (copyId ? `/u/${r.target_username}/c/${copyId}` : `/u/${r.target_username}`) : null,
    };
  });
});
