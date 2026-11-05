// Prints the SQL Better Auth needs for server/utils/auth.ts, against the current database.
// Used once per auth config change to write a dbmate migration: pnpm auth:schema
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../server/utils/auth";

const { compileMigrations } = await getMigrations(authOptions);
console.log(await compileMigrations());
process.exit(0);
