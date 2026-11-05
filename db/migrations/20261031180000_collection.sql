-- migrate:up

-- Copies (docs/SPEC.md section 5): a user's own item of a catalog model, or a wishlist entry.
create table collection_items (
  id uuid primary key default uuidv7(),
  owner_id text not null references users (id) on delete cascade,
  -- A model or a variant; catalog records are never deleted (merged ones redirect).
  catalog_id text not null references catalog_entries (id),
  status text not null
    check (status in ('owned', 'for_trade', 'for_sale', 'sold', 'wanted')),
  -- Finish, version, kit: "Chrome · Photomic DP-1 · 50mm f/1.4"
  edition text check (length(edition) <= 120),
  serial_number text check (length(serial_number) <= 40),
  hide_serial boolean not null default false,
  -- Scale from the category module (film_cameras: MODULE.md section 5).
  condition text
    check (condition in ('mint', 'near_mint', 'excellent', 'good', 'fair', 'for_parts')),
  acquired text check (length(acquired) <= 120),
  note text check (length(note) <= 2000),
  visibility text not null default 'public'
    check (visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A wishlist entry is just the model: no serial, condition or notes about a copy.
  check (status <> 'wanted' or (serial_number is null and condition is null and acquired is null))
);
create index collection_items_owner_idx on collection_items (owner_id, created_at desc);
create index collection_items_catalog_idx on collection_items (catalog_id) where status <> 'wanted';
-- One wishlist entry per model and user.
create unique index collection_items_wanted_uniq on collection_items (owner_id, catalog_id)
  where status = 'wanted';
create index collection_items_wanted_idx on collection_items (catalog_id) where status = 'wanted';

-- migrate:down

drop table collection_items;
