import type { H3Event } from "h3";

/** Session for an API route, or null when signed out. */
export async function getAuthSession(event: H3Event) {
  return auth.api.getSession({ headers: event.headers });
}

/** The signed-in user, or 401. */
export async function requireUser(event: H3Event) {
  const session = await getAuthSession(event);
  if (!session) throw createError({ statusCode: 401, statusMessage: "Sign in first" });
  return session.user;
}
