-- migrate:up

-- Roles live in users.role: 'user', 'moderator' (photos, reports) or 'admin' (also users, rarity).
alter table users add constraint users_role_check check (role in ('user', 'moderator', 'admin'));

-- Reports from users about a profile, a copy, a photo or a message.
create table reports (
  id uuid primary key default uuidv7(),
  reporter_id text references users (id) on delete set null,
  target_type text not null check (target_type in ('user', 'copy', 'photo', 'message')),
  target_id text not null,
  -- The account the report is about, for the moderator's view and for bans.
  target_user_id text references users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'harassment', 'not_own_photo', 'inappropriate', 'other')),
  details text check (length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text check (length(resolution) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text references users (id) on delete set null
);
create index reports_open_idx on reports (created_at) where status = 'open';
-- One open report per reporter and target.
create unique index reports_once_idx on reports (reporter_id, target_type, target_id) where status = 'open';

-- A blocked user cannot message the blocker or see them in owner lists.
create table user_blocks (
  blocker_id text not null references users (id) on delete cascade,
  blocked_id text not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on user_blocks (blocked_id);

-- Audit trail for moderator actions.
create table moderation_log (
  id bigint generated always as identity primary key,
  actor_id text references users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  note text,
  created_at timestamptz not null default now()
);

-- migrate:down

drop table moderation_log;
drop table user_blocks;
drop table reports;
alter table users drop constraint users_role_check;
