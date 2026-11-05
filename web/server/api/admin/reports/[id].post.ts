// Close a report: body { status: "resolved" | "dismissed", resolution? }.
export default defineEventHandler(async (event) => {
  const mod = await requireModerator(event);
  const id = getRouterParam(event, "id") ?? "";
  const { status, resolution } = await readBody<{ status?: string; resolution?: string }>(event);
  if (status !== "resolved" && status !== "dismissed") throw createError({ statusCode: 400, statusMessage: "Unknown status" });
  const note = String(resolution ?? "").trim().slice(0, 500) || null;
  const rows = await useDb()`
    update reports set status = ${status}, resolution = ${note}, resolved_at = now(), resolved_by = ${mod.id}
    where id = ${id} and status = 'open' returning id`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "No such open report" });
  await logAction(mod.id, `report.${status}`, "report", id, note);
  return { ok: true };
});
