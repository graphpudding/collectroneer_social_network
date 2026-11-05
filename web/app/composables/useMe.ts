import type { Me } from "#shared/account";

/** Signed-in user; undefined until first loaded, null when signed out. */
export const useMe = () => useState<Me | null | undefined>("me", () => undefined);

export async function loadMe(force = false) {
  const me = useMe();
  if (me.value === undefined || force) {
    me.value = await useRequestFetch()<Me | null>("/api/me").catch(() => null);
  }
  return me.value;
}

/** Sign-in options the server has configured (Google needs its keys in .env). */
export const useAuthConfig = () =>
  useFetch<{ google: boolean }>("/api/auth-config", { key: "auth-config", default: () => ({ google: false }) });

/** Where to go after signing in: ?next= when it is a local path. */
export function nextPath(fallback = "/") {
  const next = useRoute().query.next;
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
