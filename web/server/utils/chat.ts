import type { ChatEvent, ChatItem, ChatMessage } from "#shared/chat";
import { entryPath } from "#shared/catalog";

// --- Real-time bus: Postgres LISTEN/NOTIFY, so it also works with several server processes.

type Listener = (e: ChatEvent & { to: string[] }) => void;
const listeners = new Set<Listener>();
let listening: Promise<unknown> | null = null;

function ensureListening() {
  listening ??= useDb().listen("chat", (payload) => {
    const e = JSON.parse(payload);
    for (const l of listeners) l(e);
  });
  return listening;
}

export async function subscribeChat(fn: Listener) {
  await ensureListening();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function publishChat(to: string[], e: ChatEvent) {
  await useDb().notify("chat", JSON.stringify({ ...e, to }));
}

// --- Access

export type ConversationRow = {
  id: string; user_a: string; user_b: string; item_id: string | null;
  a_last_read_at: string; b_last_read_at: string; a_archived: boolean; b_archived: boolean;
};

/** A conversation the user takes part in, with which side they are; 404 otherwise. */
export async function memberConversation(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const [c] = await useDb()<ConversationRow[]>`
    select * from conversations where id = ${id} and (user_a = ${userId} or user_b = ${userId})`;
  if (!c) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const side = c.user_a === userId ? "a" : "b";
  return { c, side, otherId: side === "a" ? c.user_b : c.user_a } as const;
}

/** "me" if I blocked them, "them" if they blocked me. */
export async function blockState(meId: string, otherId: string) {
  const rows = await useDb()<{ blocker_id: string }[]>`
    select blocker_id from user_blocks
    where (blocker_id = ${meId} and blocked_id = ${otherId}) or (blocker_id = ${otherId} and blocked_id = ${meId})`;
  if (rows.some((r) => r.blocker_id === meId)) return "me" as const;
  return rows.length ? ("them" as const) : null;
}

/** Spam brakes: messages per minute, new conversations per day. */
export async function checkRate(userId: string, kind: "message" | "conversation") {
  const sql = useDb();
  const [r] = kind === "message"
    ? await sql<{ n: number }[]>`
        select count(*)::int as n from messages where sender_id = ${userId} and created_at > now() - interval '1 minute'`
    : await sql<{ n: number }[]>`
        select count(*)::int as n from conversations
        where (user_a = ${userId} or user_b = ${userId}) and created_at > now() - interval '1 day'`;
  const limit = kind === "message" ? 30 : 30;
  if ((r?.n ?? 0) >= limit) {
    throw createError({ statusCode: 429, statusMessage: kind === "message" ? "Slow down a little" : "Too many new conversations today" });
  }
}

// --- Reading

/** A copy as a card: needs to be public, or belong to the viewer. */
export async function chatItem(itemId: string | null, viewerId: string): Promise<ChatItem | null> {
  if (!itemId) return null;
  const [r] = await useDb()<any[]>`
    select i.id, i.status, i.owner_id, i.visibility, e.id as catalog_id, e.category, e.maker, e.name,
      u.username, u.is_private, u.banned,
      (select p.key_thumb from copy_photos p where p.item_id = i.id and (p.status = 'approved' or i.owner_id = ${viewerId})
         order by p.position limit 1) as thumb,
      exists (select 1 from copy_photos p where p.item_id = i.id and p.status = 'approved') as has_approved
    from collection_items i join catalog_entries e on e.id = i.catalog_id join users u on u.id = i.owner_id
    where i.id = ${itemId}`;
  if (!r) return null;
  const isPublic = r.visibility === "public" && !r.is_private && !r.banned && r.has_approved && r.status !== "wanted";
  if (!isPublic && r.owner_id !== viewerId) return null;
  return {
    id: r.id, model: `${r.maker} ${r.name}`, status: r.status, owner: r.username,
    thumbUrl: r.thumb ? publicUrl(r.thumb) : null,
    path: isPublic ? `/u/${r.username}/c/${r.id}` : entryPath({ id: r.catalog_id, category: r.category, maker: r.maker, name: r.name }),
  };
}

export async function loadMessages(conversationId: string, viewerId: string, opts: { before?: string; after?: string; limit?: number }) {
  const sql = useDb();
  const limit = opts.limit ?? 50;
  const rows = await sql<any[]>`
    select id, sender_id, body, attachment_key, attachment_thumb, attachment_width, attachment_height, item_id,
      created_at, edited_at, deleted_at
    from messages
    where conversation_id = ${conversationId}
      ${opts.before ? sql`and id < ${opts.before}` : sql``}
      ${opts.after ? sql`and id > ${opts.after}` : sql``}
    order by id ${opts.after ? sql`asc` : sql`desc`}
    limit ${limit + 1}`;
  const hasMore = !opts.after && rows.length > limit;
  const page = rows.slice(0, limit);
  if (!opts.after) page.reverse();
  const items = new Map<string, ChatItem | null>();
  for (const r of page) if (r.item_id && !items.has(r.item_id)) items.set(r.item_id, await chatItem(r.item_id, viewerId));
  const messages: ChatMessage[] = page.map((r) => ({
    id: r.id, senderId: r.sender_id, createdAt: r.created_at, editedAt: r.edited_at, deleted: !!r.deleted_at,
    body: r.deleted_at ? null : r.body,
    attachment: !r.deleted_at && r.attachment_key
      ? { fullUrl: publicUrl(r.attachment_key), thumbUrl: publicUrl(r.attachment_thumb), width: r.attachment_width, height: r.attachment_height }
      : null,
    item: r.deleted_at || !r.item_id ? null : (items.get(r.item_id) ?? null),
  }));
  return { messages, hasMore };
}

/** Sends a message and tells both sides. */
export async function sendMessage(conv: { c: ConversationRow; otherId: string }, senderId: string, fields: {
  body?: string | null; itemId?: string | null;
  attachment?: { key: string; thumb: string; width: number; height: number };
}) {
  const sql = useDb();
  const [m] = await sql<{ id: string }[]>`
    insert into messages (conversation_id, sender_id, body, item_id, attachment_key, attachment_thumb, attachment_width, attachment_height)
    values (${conv.c.id}, ${senderId}, ${fields.body ?? null}, ${fields.itemId ?? null},
      ${fields.attachment?.key ?? null}, ${fields.attachment?.thumb ?? null},
      ${fields.attachment?.width ?? null}, ${fields.attachment?.height ?? null})
    returning id`;
  // Sending reads the thread and un-archives it for both.
  const side = conv.c.user_a === senderId ? "a" : "b";
  await sql`
    update conversations set last_message_at = now(), a_archived = false, b_archived = false,
      ${side === "a" ? sql`a_last_read_at` : sql`b_last_read_at`} = now()
    where id = ${conv.c.id}`;
  await publishChat([senderId, conv.otherId], { type: "message", conversationId: conv.c.id, from: senderId });
  return m!.id;
}

/** Before sending: not blocked, other account still active. */
export async function assertCanSend(meId: string, otherId: string) {
  const blocked = await blockState(meId, otherId);
  if (blocked) throw createError({ statusCode: 403, statusMessage: blocked === "me" ? "You blocked this user" : "You can’t message this user" });
  const [u] = await useDb()<{ banned: boolean }[]>`select banned from users where id = ${otherId}`;
  if (!u || u.banned) throw createError({ statusCode: 403, statusMessage: "This account is no longer active" });
}
