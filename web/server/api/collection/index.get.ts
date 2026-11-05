// My copies and wishlist.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const [copies, wishlist] = await Promise.all([listCopies(user.id), listWishlist(user.id)]);
  return { copies, wishlist };
});
