// Badges for the admin navigation.
export default defineEventHandler(async (event) => {
  await requireModerator(event);
  const [row] = await useDb()<{ photos: number; reports: number; edits: number }[]>`
    select (select count(*)::int from copy_photos where status = 'pending') as photos,
           (select count(*)::int from reports where status = 'open') as reports,
           (select count(*)::int from catalog_edits where status = 'proposed') as edits`;
  return row;
});
