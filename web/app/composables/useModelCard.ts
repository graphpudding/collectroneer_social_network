import { idNumber, type CatalogDetail } from "#shared/catalog";
import type { ModelCard } from "#shared/collection";

/** A catalog record by id ("film_cameras:000123") as a card, or null. */
export async function fetchModelCard(id: string): Promise<ModelCard | null> {
  const category = id.split(":")[0];
  const r = await $fetch<{ found?: CatalogDetail; mergedInto?: { id: string } }>(
    `/api/catalog/${category}/${idNumber(id)}`,
  ).catch(() => null);
  if (r?.mergedInto) return fetchModelCard(r.mergedInto.id);
  const e = r?.found?.entry;
  if (!e) return null;
  return {
    id: e.id, category: e.category, name: e.name, maker: e.maker, year_start: e.year_start, year_end: e.year_end,
    country: e.country, image_url: e.image_url, attributes: e.attributes, variant_of_name: r!.found!.variantOf?.[0]?.name ?? null,
  };
}
