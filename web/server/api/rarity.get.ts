import type { RarityLevel } from "#shared/rarity";

/** Current rarity thresholds for every category, for the "How it's rated" page. */
export default defineEventHandler(async () => {
  const sql = useDb();
  const rows = await sql<{ category: string; levels: RarityLevel[]; method_version: number; updated_at: Date }[]>`
    select category, levels, method_version, updated_at from rarity_scales order by category
  `;
  return [...rows];
});
