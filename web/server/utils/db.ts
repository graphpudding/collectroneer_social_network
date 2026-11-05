import postgres from "postgres";

let sql: postgres.Sql | undefined;

/** One pool per server process. DATABASE_URL is read at runtime, not baked into the build. */
export function useDb() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example in the repo root)");
    sql = postgres(url, { max: 10 });
  }
  return sql;
}
