import type { PublicCopy } from "#shared/collection";

/**
 * Which copies other people may see: visibility "public" (followers-only stays hidden until
 * follows exist), owner's account open and not banned, at least one approved photo, not sold.
 * Hidden serial numbers never leave the server.
 */
export async function publicCopies(where: {
  ownerUsername?: string;
  catalogIds?: string[];
  id?: string;
  status?: string;
  limit?: number;
  /** Signed-in viewer: hides owners they blocked or who blocked them. */
  viewerId?: string;
}): Promise<PublicCopy[]> {
  const sql = useDb();
  const rows = await sql<any[]>`
    select i.id, i.catalog_id as "catalogId", i.status, i.edition,
      case when i.hide_serial then null else i.serial_number end as "serialNumber",
      i.condition, i.acquired, i.note, i.created_at as "createdAt",
      json_build_object('id', e.id, 'category', e.category, 'name', e.name, 'maker', e.maker,
        'year_start', e.year_start, 'year_end', e.year_end, 'country', e.country, 'image_url', e.image_url,
        'attributes', e.attributes, 'variant_of_name', null) as model,
      json_build_object('username', u.username, 'name', u.name, 'image', u.image) as owner,
      ${photosJson(sql, true)} as photos
    from collection_items i
    join users u on u.id = i.owner_id
    join catalog_entries e on e.id = i.catalog_id
    where i.status in ('owned', 'for_trade', 'for_sale')
      and i.visibility = 'public' and not u.is_private and not u.banned and u.username is not null
      and exists (select 1 from copy_photos p where p.item_id = i.id and p.status = 'approved')
      ${where.ownerUsername ? sql`and u.username = ${where.ownerUsername}` : sql``}
      ${where.catalogIds ? sql`and i.catalog_id = any(${sql.array(where.catalogIds)}::text[])` : sql``}
      ${where.id ? sql`and i.id = ${where.id}` : sql``}
      ${where.status ? sql`and i.status = ${where.status}` : sql``}
      ${where.viewerId ? sql`and not exists (select 1 from user_blocks b
        where (b.blocker_id = ${where.viewerId} and b.blocked_id = u.id) or (b.blocker_id = u.id and b.blocked_id = ${where.viewerId}))` : sql``}
    order by case i.status when 'for_trade' then 0 when 'for_sale' then 0 else 1 end, i.created_at desc
    ${where.limit ? sql`limit ${where.limit}` : sql``}`;
  return rows.map((r) => ({ ...r, photos: toPhotos(r.photos) }));
}

/** An open, active account by username, or null. */
export async function openUser(username: string) {
  const [u] = await useDb()<{ id: string; is_private: boolean; banned: boolean }[]>`
    select id, is_private, banned from users where username = ${username.toLowerCase()}`;
  return u && !u.banned ? u : null;
}
