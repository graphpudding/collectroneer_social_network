import type { Me } from "#shared/account";

export async function meById(id: string): Promise<Me | null> {
  const sql = useDb();
  const [u] = await sql<Me[]>`
    select id, username, name, email, image, bio, city, is_private as "isPrivate", role,
      exists (select 1 from accounts a where a.user_id = users.id and a.password is not null)
        as "hasPassword"
    from users where id = ${id}`;
  return u ?? null;
}
