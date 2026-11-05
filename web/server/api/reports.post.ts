import { REPORT_REASONS, type ReportTarget } from "#shared/admin";

// A user reports a profile, copy, photo or message. Body { targetType, targetId, reason, details? }.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<{ targetType?: ReportTarget; targetId?: string; reason?: string; details?: string }>(event);
  if (!body.reason || !(body.reason in REPORT_REASONS)) throw createError({ statusCode: 400, statusMessage: "Pick a reason" });
  const targetId = String(body.targetId ?? "");
  const sql = useDb();
  // Who the report is about, and that the target exists.
  const owner = await (async () => {
    switch (body.targetType) {
      case "user": return (await sql`select id from users where username = ${targetId.toLowerCase()}`)[0]?.id;
      case "copy": return (await sql`select owner_id as id from collection_items where id::text = ${targetId}`)[0]?.id;
      case "photo": return (await sql`select owner_id as id from copy_photos where id::text = ${targetId}`)[0]?.id;
      case "message": return (await sql`select sender_id as id from messages where id::text = ${targetId}`.catch(() => []))[0]?.id;
      default: return undefined;
    }
  })();
  if (!owner) throw createError({ statusCode: 404, statusMessage: "Nothing to report" });
  if (owner === user.id) throw createError({ statusCode: 400, statusMessage: "That’s yours" });
  await sql`
    insert into reports (reporter_id, target_type, target_id, target_user_id, reason, details)
    values (${user.id}, ${body.targetType!}, ${targetId}, ${owner}, ${body.reason},
            ${String(body.details ?? "").trim().slice(0, 1000) || null})
    on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing`;
  return { reported: true };
});
