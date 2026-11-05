// Pages with definePageMeta({ auth: true }) need a session; guestOnly pages (log in, sign up)
// send signed-in users on. Anyone without a username yet (first Google sign-in) picks one first.
export default defineNuxtRouteMiddleware(async (to) => {
  const me = await loadMe();
  if (me && !me.username && to.path !== "/welcome") {
    return navigateTo({ path: "/welcome", query: { next: to.fullPath } });
  }
  if (to.meta.auth && !me) return navigateTo({ path: "/login", query: { next: to.fullPath } });
  if (to.meta.guestOnly && me) return navigateTo("/");
  // Staff pages look like any missing page to everyone else.
  const role = to.meta.role;
  if (role && !(me?.role === "admin" || (role === "moderator" && me?.role === "moderator"))) {
    throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });
  }
});
