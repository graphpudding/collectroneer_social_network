-- migrate:up

create extension if not exists pg_trgm;

-- Lowercase, drop everything but letters and digits: "Zenit-E" and "zenit e" both become "zenite".
create function catalog_compact(t text) returns text
language sql immutable parallel safe
return regexp_replace(lower(t), '[^[:alnum:]]+', '', 'g');

-- Core catalog record, shared by every category (docs/SPEC.md, section 3).
-- Category-specific fields live in `attributes`, validated by the pipeline against the module schema.
create table catalog_entries (
  id               text primary key,          -- "film_cameras:000001", permanent
  status           text not null default 'active'
                   check (status in ('active', 'merged', 'retired')),
  merged_into      text references catalog_entries (id),
  category         text not null,
  name             text not null,
  maker            text not null,
  labels           jsonb not null default '{}',   -- {lang: name}
  aliases          text[] not null default '{}',
  year_start       int,
  year_end         int,
  country          text,
  production_count jsonb,                          -- {value, min, max, basis, source: {url, quote}}
  attributes       jsonb not null default '{}',
  image_url        text,
  image_license    text,
  image_author     text,
  external_ids     jsonb not null default '{}',
  source_urls      text[] not null default '{}',
  field_sources    jsonb not null default '{}',
  data_license     text not null,
  attribution      text[] not null default '{}',
  match_confidence text,
  notes            text,
  -- Maintained by the trigger below; used only for search.
  search_text      text not null default '',
  search_compact   text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  check (id like category || ':%'),
  check ((status = 'merged') = (merged_into is not null)),
  check (image_url is null or image_license is not null)
);

create index catalog_entries_category_idx on catalog_entries (category, status);
create index catalog_entries_attributes_idx on catalog_entries using gin (attributes jsonb_path_ops);
create index catalog_entries_search_text_idx on catalog_entries using gin (search_text gin_trgm_ops);
create index catalog_entries_search_compact_idx on catalog_entries using gin (search_compact gin_trgm_ops);

create function catalog_entries_before_write() returns trigger
language plpgsql as $$
declare
  names text := concat_ws(' ',
    new.maker || ' ' || new.name,
    array_to_string(new.aliases, ' '),
    (select string_agg(value, ' ') from jsonb_each_text(new.labels)));
begin
  new.search_text := lower(names);
  -- Each name compacted separately so "nikonf2" matches but words of different names don't fuse.
  new.search_compact := (
    select string_agg(distinct catalog_compact(n), ' ')
    from unnest(array[new.maker || new.name] || new.aliases
                || array(select value from jsonb_each_text(new.labels))) as n);
  new.updated_at := now();
  return new;
end $$;

create trigger catalog_entries_before_write
before insert or update on catalog_entries
for each row execute function catalog_entries_before_write();

-- Links between records, e.g. Canon F-1N variant_of Canon F-1.
create table catalog_relations (
  from_id  text not null references catalog_entries (id) on delete cascade,
  relation text not null check (relation in ('variant_of')),
  to_id    text not null references catalog_entries (id) on delete cascade,
  source   text,
  primary key (from_id, relation, to_id),
  check (from_id <> to_id)
);

create index catalog_relations_to_idx on catalog_relations (to_id, relation);

-- migrate:down

drop table catalog_relations;
drop table catalog_entries;
drop function catalog_entries_before_write;
drop function catalog_compact;
