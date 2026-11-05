// Approve or reject photos: body { ids, action: "approve" | "reject", reason? }.
export default defineEventHandler(async (event) => {
  const mod = await requireModerator(event);
  const { ids, action, reason } = await readBody<{ ids?: string[]; action?: string; reason?: string }>(event);
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw createError({ statusCode: 400, statusMessage: "Pick photos" });
  if (action !== "approve" && action !== "reject") throw createError({ statusCode: 400, statusMessage: "Unknown action" });
  const note = action === "reject" ? String(reason ?? "").trim().slice(0, 200) || "Doesn’t follow the photo rules" : null;
  const sql = useDb();
  const rows = await sql<{ id: string }[]>`
    update copy_photos
    set status = ${action === "approve" ? "approved" : "rejected"}, reject_reason = ${note},
        reviewed_at = now(), reviewed_by = ${mod.id}
    where id = any(${sql.array(ids)}::uuid[])
    returning id`;
  for (const r of rows) await logAction(mod.id, `photo.${action}`, "photo", r.id, note);
  return { updated: rows.length };
});
