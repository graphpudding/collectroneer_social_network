-- migrate:up

-- Rarity thresholds per category, edited from the admin panel (docs/PLAN.md, rarity).
-- levels: ordered from most common to rarest, each with the lowest production that still
-- qualifies: [{"key": "common", "label": "Common", "min_production": 500000}, ...].
-- The rarest level has min_production 0.
create table rarity_scales (
  category       text primary key,
  levels         jsonb not null check (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) >= 2),
  method_version int not null default 1,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

insert into rarity_scales (category, levels) values ('film_cameras', '[
  {"key": "common",    "label": "Common",    "min_production": 500000},
  {"key": "uncommon",  "label": "Uncommon",  "min_production": 100000},
  {"key": "scarce",    "label": "Scarce",    "min_production": 20000},
  {"key": "rare",      "label": "Rare",      "min_production": 2000},
  {"key": "very_rare", "label": "Very rare", "min_production": 0}
]');

-- migrate:down

drop table rarity_scales;
