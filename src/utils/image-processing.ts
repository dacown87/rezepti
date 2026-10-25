// Image normalisation for photo uploads: strips EXIF/GPS/XMP/IPTC by re-encoding,
// applies EXIF orientation, and produces bounded JPEGs for the vision model and
// for stored recipe cover images.
//
// `sharp` is a libvips native dependency (prebuilt, glibc, no apt package needed).
// A small Northflank instance is memory-constrained, so the process-wide cache is
// disabled and concurrency capped at 1; the per-user/per-server job limits bound
// parallel work further.

import sharp from "sharp";

sharp.cache(false);
sharp.concurrency(1);

export class UnsupportedImageError extends Error {
  constructor() {
    super("Unsupported or unreadable image");
    this.name = "UnsupportedImageError";
  }
}

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const VISION_MAX_EDGE = 2048;
const VISION_MAX_BYTES = 3 * 1024 * 1024; // Groq rejects larger base64 requests
const STORED_MAX_BYTES = 250_000;
const PIXEL_LIMIT = 40_000_000; // decompression-bomb guard

async function render(buf: Buffer, edge: number, quality: number): Promise<Buffer> {
  return sharp(buf, { limitInputPixels: PIXEL_LIMIT, failOn: "error" })
    .rotate() // apply EXIF orientation
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer();
}

/** Returns the detected format (jpeg/png/webp only); throws for anything else. */
export async function inspectImage(buf: Buffer): Promise<{ format: string; width?: number; height?: number }> {
  let meta: { format?: string; width?: number; height?: number };
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new UnsupportedImageError();
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new UnsupportedImageError();
  }
  return { format: meta.format, width: meta.width, height: meta.height };
}

/**
 * Produces a metadata-free JPEG for the vision model (max 2048 px edge, quality
 * stepped down until it fits the Groq request limit). No `.withMetadata()`, so
 * the output carries no EXIF/XMP/IPTC.
 */
export async function normalizeForVision(buf: Buffer): Promise<{ bytes: Buffer; mime: string }> {
  await inspectImage(buf);

  let edge = VISION_MAX_EDGE;
  let quality = 85;
  let out = await render(buf, edge, quality);
  while (out.length > VISION_MAX_BYTES && quality > 55) {
    quality -= 10;
    out = await render(buf, edge, quality);
  }
  if (out.length > VISION_MAX_BYTES) {
    edge = 1600;
    quality = 85;
    out = await render(buf, edge, quality);
    while (out.length > VISION_MAX_BYTES && quality > 50) {
      quality -= 10;
      out = await render(buf, edge, quality);
    }
  }

  return { bytes: out, mime: "image/jpeg" };
}

/**
 * Produces a compact metadata-free JPEG (≤ 250 KB) for the stored recipe cover
 * image. Starts at 1024 px / quality 75 and steps down to 800 px / quality 50.
 */
export async function toStoredRecipeImage(
  buf: Buffer,
): Promise<{ bytes: Buffer; mime: string; width: number; height: number }> {
  await inspectImage(buf);

  let edge = 1024;
  let quality = 75;
  let out = await render(buf, edge, quality);
  while (out.length > STORED_MAX_BYTES && quality > 50) {
    quality -= 5;
    out = await render(buf, edge, quality);
  }
  if (out.length > STORED_MAX_BYTES) {
    edge = 800;
    quality = 70;
    out = await render(buf, edge, quality);
    while (out.length > STORED_MAX_BYTES && quality > 50) {
      quality -= 5;
      out = await render(buf, edge, quality);
    }
  }

  const meta = await sharp(out).metadata();
  return { bytes: out, mime: "image/jpeg", width: meta.width ?? 0, height: meta.height ?? 0 };
}
