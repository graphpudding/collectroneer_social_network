export default defineEventHandler(async (event) => listEdits({ userId: (await requireUser(event)).id }));
