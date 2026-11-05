// Better Auth client for actions (sign up, sign in, Google, sign out). Who is signed in comes
// from /api/me (useMe), which also works during server rendering.
import { createAuthClient } from "better-auth/vue";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [usernameClient()] });

/** Better Auth error -> one line for the form. */
export function authErrorText(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return "";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.code === "INVALID_USERNAME_OR_PASSWORD")
    return "Wrong email or password. Try again.";
  if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
    return "An account with this email already exists. Log in instead.";
  if (error.code === "USERNAME_IS_ALREADY_TAKEN") return "This username is taken.";
  return error.message ?? "Something went wrong. Try again.";
}
