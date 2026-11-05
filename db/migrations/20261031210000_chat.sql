-- migrate:up

-- Direct messages between two users. The pair is stored ordered (user_a < user_b), so there is
-- one conversation per pair; per-member state sits in the a_/b_ columns.
create table conversations (
  id uuid primary key default uuidv7(),
  user_a text not null references users (id) on delete cascade,
  user_b text not null references users (id) on delete cascade,
  -- The copy the conversation started about, if any ("Message about trade").
  item_id uuid references collection_items (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  a_last_read_at timestamptz not null default '-infinity',
  b_last_read_at timestamptz not null default '-infinity',
  a_archived boolean not null default false,
  b_archived boolean not null default false,
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index conversations_a_idx on conversations (user_a, last_message_at desc);
create index conversations_b_idx on conversations (user_b, last_message_at desc);

create table messages (
  id uuid primary key default uuidv7(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id text not null references users (id) on delete cascade,
  body text check (length(body) <= 4000),
  -- An attached photo (stored like copy photos, metadata stripped).
  attachment_key text,
  attachment_thumb text,
  attachment_width integer,
  attachment_height integer,
  -- A copy shown as a card inside the message.
  item_id uuid references collection_items (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- Deleted messages keep their place in the thread without content.
  deleted_at timestamptz,
  check (deleted_at is not null or body is not null or attachment_key is not null or item_id is not null)
);
create index messages_conversation_idx on messages (conversation_id, created_at desc);
create index messages_sender_recent_idx on messages (sender_id, created_at desc);

-- migrate:down

drop table messages;
drop table conversations;
