-- migrate:up

-- Accounts (Better Auth, web/server/utils/auth.ts). Generated with `pnpm auth:schema`, then
-- given defaults so rows written outside Better Auth are complete too.
create table users (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Public address /u/<username>; Better Auth stores it lowercased.
  username text unique,
  display_username text,
  role text not null default 'user',
  banned boolean not null default false,
  ban_reason text,
  ban_expires timestamptz,
  bio text,
  city text,
  -- Closed account: profile and copies visible to the owner only.
  is_private boolean not null default false
);

create table sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  user_id text not null references users (id) on delete cascade,
  impersonated_by text
);
create index sessions_user_id_idx on sessions (user_id);

create table accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references users (id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null
);
create index accounts_user_id_idx on accounts (user_id);

create table verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verifications_identifier_idx on verifications (identifier);

-- migrate:down

drop table verifications;
drop table accounts;
drop table sessions;
drop table users;
