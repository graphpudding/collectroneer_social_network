/** Contact address and operator from .env (NUXT_PUBLIC_CONTACT_EMAIL, NUXT_PUBLIC_OPERATOR). */
export function useSiteInfo() {
  const c = useRuntimeConfig().public;
  return { contactEmail: (c.contactEmail as string) || null, operator: (c.operator as string) || null };
}
