// Approve (apply to the catalog) or reject a suggestion: body { action, note? }.
export default defineEventHandler(async (event) => {
  const mod = await requireModerator(event);
  const id = getRouterParam(event, "id") ?? "";
  const { action, note } = await readBody<{ action?: string; note?: string }>(event);
  if (action !== "approve" && action !== "reject") throw createError({ statusCode: 400, statusMessage: "Unknown action" });
  const reviewNote = String(note ?? "").trim().slice(0, 500) || null;
  const sql = useDb();
  await sql.begin(async (tx) => {
    const [edit] = await tx<any[]>`select * from catalog_edits where id = ${id} and status = 'proposed' for update`;
    if (!edit) throw createError({ statusCode: 404, statusMessage: "No such open suggestion" });
    const resultId = action === "approve" ? await applyEdit(tx, edit) : null;
    await tx`
      update catalog_edits set status = ${action === "approve" ? "approved" : "rejected"}, review_note = ${reviewNote},
        reviewed_by = ${mod.id}, reviewed_at = now(), result_catalog_id = ${resultId}
      where id = ${id}`;
  });
  await logAction(mod.id, `edit.${action}`, "catalog_edit", id, reviewNote);
  return { ok: true };
});
