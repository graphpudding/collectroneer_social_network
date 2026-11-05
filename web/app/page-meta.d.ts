declare module "#app" {
  interface PageMeta {
    /** Requires a signed-in user (app/middleware/auth.global.ts). */
    auth?: boolean;
    /** Log in / sign up: signed-in users are sent on. */
    guestOnly?: boolean;
    /** Staff only: moderators (and admins), or admins only. */
    role?: "moderator" | "admin";
  }
}
export {};
