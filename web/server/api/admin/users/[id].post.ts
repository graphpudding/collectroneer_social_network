// Change a user's role or ban state: body { role?, banned?, banReason? }. A ban signs them out.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id") ?? "";
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: "Not on your own account" });
  const body = await readBody<{ role?: string; banned?: boolean; banReason?: string }>(event);
  const sql = useDb();
  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) {
    if (!["user", "moderator", "admin"].includes(body.role)) throw createError({ statusCode: 400, statusMessage: "Unknown role" });
    patch.role = body.role;
  }
  if (typeof body.banned === "boolean") {
    patch.banned = body.banned;
    patch.ban_reason = body.banned ? String(body.banReason ?? "").trim().slice(0, 300) || null : null;
  }
  if (!Object.keys(patch).length) return { ok: true };
  const rows = await sql`update users set ${sql(patch)}, updated_at = now() where id = ${id} returning id`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "No such user" });
  if (patch.banned === true) await sql`delete from sessions where user_id = ${id}`;
  const action = patch.banned === true ? "user.ban" : patch.banned === false ? "user.unban" : `user.role.${patch.role}`;
  await logAction(admin.id, action, "user", id, (patch.ban_reason as string) ?? null);
  return { ok: true };
});
