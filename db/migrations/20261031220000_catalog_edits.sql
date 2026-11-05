-- migrate:up

-- Catalog changes suggested by users (docs/SPEC.md section 6). Applied to catalog_entries when
-- approved; the pipeline pulls approved ones (catalog user-edits pull) so rebuilds keep them.
create table catalog_edits (
  id uuid primary key default uuidv7(),
  user_id text references users (id) on delete set null,
  kind text not null check (kind in ('edit', 'new_model', 'merge')),
  -- edit / merge: the record changed (merge: the duplicate that goes away).
  catalog_id text references catalog_entries (id),
  category text not null,
  -- edit: { "<field path>": value }; new_model: the new record's fields; merge: { "into": id }.
  changes jsonb not null,
  source text not null check (length(source) between 3 and 500),
  note text check (length(note) <= 1000),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  review_note text check (length(review_note) <= 500),
  reviewed_by text references users (id) on delete set null,
  reviewed_at timestamptz,
  -- new_model: the id the record got.
  result_catalog_id text references catalog_entries (id),
  created_at timestamptz not null default now(),
  check ((kind = 'new_model') = (catalog_id is null))
);
create index catalog_edits_proposed_idx on catalog_edits (created_at) where status = 'proposed';
create index catalog_edits_user_idx on catalog_edits (user_id, created_at desc);
create index catalog_edits_catalog_idx on catalog_edits (catalog_id);

-- migrate:down

drop table catalog_edits;
