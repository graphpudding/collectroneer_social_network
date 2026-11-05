import { sectionByCategory } from "#shared/catalog";

export default defineEventHandler(async (event) => {
  const category = getRouterParam(event, "category") ?? "";
  const number = getRouterParam(event, "number") ?? "";
  if (!sectionByCategory(category) || !/^\d{1,12}$/.test(number)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const result = await getCatalogEntry(`${category}:${number}`);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return result;
});
