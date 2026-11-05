export type ThemeChoice = "light" | "dark" | "auto";

/** Theme from a cookie, so the server renders the right one; light unless chosen otherwise. */
export function useTheme() {
  return useCookie<ThemeChoice>("theme", { default: () => "light", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
