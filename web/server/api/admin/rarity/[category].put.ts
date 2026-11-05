import type { RarityLevel } from "#shared/rarity";

// New thresholds for a category: levels from most common to rarest, min_production strictly
// decreasing, the last one 0 so every figure gets a level.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const category = getRouterParam(event, "category") ?? "";
  const { levels } = await readBody<{ levels?: RarityLevel[] }>(event);
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m });
  if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10) throw bad("2 to 10 levels");
  const clean = levels.map((l, i) => {
    const label = String(l.label ?? "").trim();
    const min = Number(l.min_production);
    if (!label || label.length > 30) throw bad(`Level ${i + 1}: a short name`);
    if (!Number.isInteger(min) || min < 0) throw bad(`Level ${i + 1}: a whole number, 0 or more`);
    return { key: String(l.key ?? label).toLowerCase().replace(/[^a-z0-9]+/g, "_"), label, min_production: min };
  });
  for (let i = 1; i < clean.length; i++) {
    if (clean[i]!.min_production >= clean[i - 1]!.min_production) throw bad("Each level needs a lower threshold than the one above");
  }
  if (clean.at(-1)!.min_production !== 0) throw bad("The rarest level must start at 0");
  const sql = useDb();
  const rows = await sql`
    update rarity_scales set levels = ${sql.json(clean)}, method_version = method_version + 1,
      updated_at = now(), updated_by = ${admin.id}
    where category = ${category} returning category`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "No such category" });
  await logAction(admin.id, "rarity.update", "rarity_scale", category, JSON.stringify(clean));
  return { ok: true };
});
