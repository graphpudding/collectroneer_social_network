import { usernameProblem } from "#shared/account";

// Live check for the sign-up and settings forms.
export default defineEventHandler(async (event) => {
  const name = String(getQuery(event).u ?? "").trim().toLowerCase();
  const problem = usernameProblem(name);
  if (problem) return { available: false, problem };
  const session = await getAuthSession(event);
  const [taken] = await useDb()`
    select 1 from users where username = ${name} and id <> ${session?.user.id ?? ""}`;
  return taken ? { available: false, problem: "This name is taken" } : { available: true, problem: null };
});
