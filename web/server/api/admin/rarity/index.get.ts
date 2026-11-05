export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return useDb()`
    select s.category, s.levels, s.method_version as "methodVersion", s.updated_at as "updatedAt", u.username as "updatedBy"
    from rarity_scales s left join users u on u.id = s.updated_by
    order by s.category`;
});
