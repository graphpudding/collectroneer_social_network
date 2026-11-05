// Account rules shared by the sign-up form and the server.

/** Public address /u/<username>: lowercase letters, digits, dot, underscore, dash. */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;

export const RESERVED_USERNAMES = new Set([
  "admin", "api", "about", "account", "auth", "cameras", "collection", "help", "login", "logout",
  "me", "messages", "moderator", "settings", "signup", "support", "u", "user", "welcome",
]);

export function usernameProblem(name: string): string | null {
  if (name.length < 3) return "At least 3 characters";
  if (name.length > 30) return "At most 30 characters";
  if (!USERNAME_RE.test(name)) return "Lowercase letters, digits, dot, underscore or dash";
  if (RESERVED_USERNAMES.has(name)) return "This name is reserved";
  return null;
}

export const profilePath = (username: string) => `/u/${username}`;

/** The signed-in user as the app sees it (GET /api/me). */
export type Me = {
  id: string;
  username: string | null;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  city: string | null;
  isPrivate: boolean;
  role: string;
  hasPassword: boolean;
};

export const BIO_MAX = 300;
export const NAME_MAX = 60;
export const CITY_MAX = 60;

/** Public display name: the name the user typed in settings, otherwise the username. */
export const userDisplayName = (u: { name: string; username: string | null }) =>
  u.name && u.name !== u.username ? u.name : (u.username ?? "");

/** A user as others see them. */
export type PublicUser = { username: string; name: string; image: string | null };

export type PublicProfile = PublicUser & {
  bio: string | null;
  city: string | null;
  joinedAt: string;
  /** Closed account: nothing else is shown. */
  closed: boolean;
  counts: { copies: number; wishlist: number; byStatus: Record<string, number> };
};
