import type { H3Event } from "h3";
import type { Role } from "#shared/admin";

/** The signed-in user if they have one of these roles, else 403. */
export async function requireRole(event: H3Event, ...roles: Role[]) {
  const user = await requireUser(event);
  const [row] = await useDb()<{ role: Role }[]>`select role from users where id = ${user.id}`;
  if (!row || !roles.includes(row.role)) throw createError({ statusCode: 403, statusMessage: "Not allowed" });
  return { ...user, role: row.role };
}

export const requireModerator = (event: H3Event) => requireRole(event, "moderator", "admin");
export const requireAdmin = (event: H3Event) => requireRole(event, "admin");

export async function logAction(actorId: string, action: string, targetType: string, targetId: string, note?: string | null) {
  await useDb()`
    insert into moderation_log (actor_id, action, target_type, target_id, note)
    values (${actorId}, ${action}, ${targetType}, ${targetId}, ${note ?? null})`;
}
