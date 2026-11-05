// File storage: Cloudflare R2 when its keys are set, otherwise web/.data/uploads (development),
// served by server/routes/uploads/[...path].ts.
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const env = process.env;
const r2 = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL;
export const LOCAL_ROOT = resolve(".data/uploads");

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

export function publicUrl(key: string) {
  return r2 ? `${env.R2_PUBLIC_URL}/${key}` : `/uploads/${key}`;
}

export async function putFile(key: string, body: Buffer, contentType: string) {
  if (r2) {
    await s3().send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return;
  }
  const path = join(LOCAL_ROOT, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function deleteFiles(keys: string[]) {
  if (!keys.length) return;
  if (r2) {
    for (let i = 0; i < keys.length; i += 1000) {
      await s3().send(new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }));
    }
    return;
  }
  await Promise.all(keys.map((k) => rm(join(LOCAL_ROOT, k), { force: true })));
}

/** Storage key of an avatar URL we issued, or null for outside images (Google). */
export function avatarKey(url: string) {
  const prefix = publicUrl("");
  return url.startsWith(prefix) && url.slice(prefix.length).startsWith("avatars/") ? url.slice(prefix.length) : null;
}
