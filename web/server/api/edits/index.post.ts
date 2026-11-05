// Suggest a change: body { kind: "edit" | "new_model" | "merge", catalogId?, changes, source, note? }.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const s = await parseSuggestion(await readBody(event));
  const sql = useDb();
  const [today] = await sql<{ n: number }[]>`
    select count(*)::int as n from catalog_edits where user_id = ${user.id} and created_at > now() - interval '1 day'`;
  if ((today?.n ?? 0) >= 50) throw createError({ statusCode: 429, statusMessage: "That’s a lot for one day. Thank you! Try again tomorrow." });
  const [row] = await sql<{ id: string }[]>`
    insert into catalog_edits (user_id, kind, catalog_id, category, changes, source, note)
    values (${user.id}, ${s.kind}, ${s.catalogId}, ${s.category}, ${sql.json(s.changes as any)}, ${s.source}, ${s.note})
    returning id`;
  return { id: row!.id };
});
