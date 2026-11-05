import type { PendingPhoto } from "#shared/admin";
import { entryPath } from "#shared/catalog";

// Photo queue, oldest first.
export default defineEventHandler(async (event): Promise<PendingPhoto[]> => {
  await requireModerator(event);
  const rows = await useDb()<any[]>`
    select p.id, p.key_full, p.key_thumb, p.width, p.height, p.created_at, p.item_id,
      e.id as catalog_id, e.category, e.maker, e.name, u.username, u.id as owner_id
    from copy_photos p
    join collection_items i on i.id = p.item_id
    join catalog_entries e on e.id = i.catalog_id
    join users u on u.id = p.owner_id
    where p.status = 'pending'
    order by p.created_at
    limit 60`;
  return rows.map((r) => ({
    id: r.id, thumbUrl: publicUrl(r.key_thumb), fullUrl: publicUrl(r.key_full), width: r.width, height: r.height,
    createdAt: r.created_at, itemId: r.item_id, model: `${r.maker} ${r.name}`,
    modelPath: entryPath({ id: r.catalog_id, category: r.category, maker: r.maker, name: r.name }),
    owner: { username: r.username, id: r.owner_id },
  }));
});
