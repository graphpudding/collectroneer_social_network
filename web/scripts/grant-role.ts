// Gives a user a role: pnpm grant-role <username> <admin|moderator|user>
import postgres from "postgres";

const [username, role = "admin"] = process.argv.slice(2);
if (!username || !["admin", "moderator", "user"].includes(role)) {
  console.error("usage: pnpm grant-role <username> <admin|moderator|user>");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!);
const rows = await sql`update users set role = ${role} where username = ${username.toLowerCase()} returning username, role`;
console.log(rows.length ? `${rows[0]!.username} is now ${rows[0]!.role}` : `no user @${username}`);
await sql.end();
