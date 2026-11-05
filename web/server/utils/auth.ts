// Accounts: Better Auth over its own pg pool. Tables live in db/migrations (generated once from
// this config with scripts/auth-schema.ts), mapped to the repo's plural snake_case names.
import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { Pool } from "pg";
import { usernameProblem } from "../../shared/account";

const snake = <T extends string>(...names: T[]) =>
  Object.fromEntries(names.map((n) => [n, n.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)])) as Record<T, string>;

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const authOptions = {
  appName: "Collectors Note",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No mail provider yet: verification and password reset are "coming soon".
    requireEmailVerification: false,
  },
  socialProviders: google,
  user: {
    modelName: "users",
    fields: snake("emailVerified", "createdAt", "updatedAt"),
    additionalFields: {
      bio: { type: "string", required: false, input: true },
      city: { type: "string", required: false, input: true },
      // Closed account: the profile and its copies are visible to the owner only.
      isPrivate: { type: "boolean", required: false, defaultValue: false, input: true, fieldName: "is_private" },
    },
  },
  session: {
    modelName: "sessions",
    fields: snake("expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId"),
  },
  account: {
    modelName: "accounts",
    fields: snake(
      "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
      "accessTokenExpiresAt", "refreshTokenExpiresAt", "createdAt", "updatedAt",
    ),
  },
  verification: { modelName: "verifications", fields: snake("expiresAt", "createdAt", "updatedAt") },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (name) => usernameProblem(name) === null,
      schema: { user: { fields: snake("displayUsername") } },
    }),
    admin({
      schema: {
        user: { fields: snake("banReason", "banExpires") },
        session: { fields: snake("impersonatedBy") },
      },
    }),
  ],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);
