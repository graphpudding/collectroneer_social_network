// Local uploads in development, when R2 is not configured.
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

export default defineEventHandler(async (event) => {
  const path = normalize(getRouterParam(event, "path") ?? "");
  if (path.startsWith("..") || path.includes("\0")) throw createError({ statusCode: 404 });
  const data = await readFile(join(LOCAL_ROOT, path)).catch(() => null);
  if (!data) throw createError({ statusCode: 404 });
  setHeader(event, "Content-Type", path.endsWith(".webp") ? "image/webp" : "application/octet-stream");
  setHeader(event, "Cache-Control", "public, max-age=31536000, immutable");
  return data;
});
