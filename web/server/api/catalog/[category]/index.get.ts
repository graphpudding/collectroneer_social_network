import { PAGE_SIZE, sectionByCategory } from "#shared/catalog";

export default defineEventHandler(async (event) => {
  const section = sectionByCategory(getRouterParam(event, "category") ?? "");
  if (!section) throw createError({ statusCode: 404, statusMessage: "Unknown category" });

  const query = getQuery(event);
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const many = (v: unknown) =>
    (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && !!x)
      .slice(0, 20).map((x) => x.slice(0, 100));
  const filters = Object.fromEntries(section.filters.map((f) => [f.key, many(query[f.key])]));

  return listCatalog(section, {
    q: String(one(query.q) ?? "").trim().slice(0, 100),
    limit: PAGE_SIZE,
    // Pages count from 1; past the last page the list is simply empty.
    offset: (Math.max(Math.floor(Number(one(query.page))) || 1, 1) - 1) * PAGE_SIZE,
    sort: one(query.sort) === "year" ? "year" : "az",
    filters,
  });
});
