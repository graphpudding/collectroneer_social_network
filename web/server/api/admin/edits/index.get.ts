export default defineEventHandler(async (event) => {
  await requireModerator(event);
  return listEdits({ status: getQuery(event).status === "closed" ? "closed" : "proposed" });
});
