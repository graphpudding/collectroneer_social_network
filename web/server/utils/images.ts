// Uploaded photos: turned upright, stripped of all metadata (EXIF GPS included), re-encoded.
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const INPUT_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

async function readImage(data: Buffer) {
  const image = sharp(data, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
  const meta = await image.metadata().catch(() => null);
  if (!meta?.format || !INPUT_FORMATS.has(meta.format)) {
    throw createError({ statusCode: 400, statusMessage: "Use a JPG, PNG or WebP photo" });
  }
  return image;
}

/** Display size (long edge 1600) and a square thumbnail (600). sharp drops metadata by default. */
export async function processCopyPhoto(data: Buffer) {
  const image = await readImage(data);
  const full = await image.clone().resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
  const thumb = await image.clone().resize(600, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 80 }).toBuffer();
  return { full: full.data, thumb, width: full.info.width, height: full.info.height };
}

export async function processAvatar(data: Buffer) {
  const image = await readImage(data);
  return image.resize(400, 400, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
}

/** One file from a multipart body, size-checked. */
export async function readUpload(event: Parameters<typeof readMultipartFormData>[0]) {
  const length = Number(getHeader(event, "content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw createError({ statusCode: 413, statusMessage: "Up to 20 MB per photo" });
  const parts = await readMultipartFormData(event);
  const file = parts?.find((p) => p.name === "file" && p.data?.length);
  if (!file) throw createError({ statusCode: 400, statusMessage: "No file" });
  if (file.data.length > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, statusMessage: "Up to 20 MB per photo" });
  return file.data;
}
