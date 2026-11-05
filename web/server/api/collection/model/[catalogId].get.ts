import type { MyModelState } from "#shared/collection";

// What I have of one model: copies and whether it is on my wishlist. Signed out: nothing.
export default defineEventHandler(async (event): Promise<MyModelState> => {
  const session = await getAuthSession(event);
  if (!session) return { copies: [], wanted: false };
  const rows = await useDb()<{ id: string; status: string }[]>`
    select id, status from collection_items
    where owner_id = ${session.user.id} and catalog_id = ${getRouterParam(event, "catalogId") ?? ""}
    order by created_at`;
  return {
    copies: rows.filter((r) => r.status !== "wanted") as MyModelState["copies"],
    wanted: rows.some((r) => r.status === "wanted"),
  };
});
