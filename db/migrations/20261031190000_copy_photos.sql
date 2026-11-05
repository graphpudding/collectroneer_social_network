-- migrate:up

-- Photos of a copy. Stored as files (R2, or local disk in development); only approved photos
-- are public. position 0 is the cover.
create table copy_photos (
  id uuid primary key default uuidv7(),
  item_id uuid not null references collection_items (id) on delete cascade,
  owner_id text not null references users (id) on delete cascade,
  position integer not null default 0,
  -- Storage keys: the display size and the square thumbnail.
  key_full text not null,
  key_thumb text not null,
  width integer not null,
  height integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text references users (id) on delete set null
);
create index copy_photos_item_idx on copy_photos (item_id, position);
create index copy_photos_pending_idx on copy_photos (created_at) where status = 'pending';

-- migrate:down

drop table copy_photos;
