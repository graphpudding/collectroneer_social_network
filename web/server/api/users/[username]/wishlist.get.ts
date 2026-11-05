import type { WishlistItem } from "#shared/collection";

// Wishlists of open accounts are public: that is how trades find each other.
export default defineEventHandler(async (event): Promise<WishlistItem[]> => {
  const user = await openUser(String(getRouterParam(event, "username")));
  if (!user || user.is_private) return [];
  return listWishlist(user.id);
});
