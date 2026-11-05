import type { ConversationSummary } from "#shared/chat";

// My conversations, newest activity first; ?archived=1 for the archive.
export default defineEventHandler(async (event): Promise<ConversationSummary[]> => {
  const me = await requireUser(event);
  const archived = getQuery(event).archived === "1";
  const sql = useDb();
  const rows = await sql<any[]>`
    with mine as (
      select c.*, case when c.user_a = ${me.id} then c.user_b else c.user_a end as other_id,
        case when c.user_a = ${me.id} then c.a_last_read_at else c.b_last_read_at end as my_read,
        case when c.user_a = ${me.id} then c.a_archived else c.b_archived end as my_archived
      from conversations c where c.user_a = ${me.id} or c.user_b = ${me.id}
    )
    select m.id, m.my_archived, u.id as uid, u.username, u.name, u.image,
      l.body, l.attachment_key, l.item_id, l.deleted_at, l.sender_id, l.created_at as last_at,
      (select count(*)::int from messages x
        where x.conversation_id = m.id and x.sender_id <> ${me.id} and x.created_at > m.my_read and x.deleted_at is null) as unread
    from mine m
    join users u on u.id = m.other_id
    left join lateral (select * from messages x where x.conversation_id = m.id order by x.id desc limit 1) l on true
    where m.my_archived = ${archived} and l.id is not null
    order by m.last_message_at desc
    limit 200`;
  return rows.map((r) => ({
    id: r.id,
    other: { id: r.uid, username: r.username, name: r.name, image: r.image },
    last: {
      preview: r.deleted_at ? "Message deleted" : r.body ? r.body.slice(0, 140) : r.attachment_key ? "Photo" : "Copy",
      mine: r.sender_id === me.id,
      at: r.last_at,
    },
    unread: r.unread,
    archived: r.my_archived,
  }));
});
