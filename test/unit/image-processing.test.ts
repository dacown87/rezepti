import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  inspectImage,
  normalizeForVision,
  toStoredRecipeImage,
  UnsupportedImageError,
} from "../../src/utils/image-processing.js";

// Generated in-memory so the suite stays hermetic (no binary fixture needed).
let orientation6Jpeg: Buffer;
let transparentPng: Buffer;
let gifImage: Buffer;
let noisyJpeg: Buffer;

beforeAll(async () => {
  // Portrait 100x200 JPEG with EXIF orientation 6 (rotate 90° on display).
  orientation6Jpeg = await sharp({
    create: { width: 100, height: 200, channels: 3, background: "#cc0000" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  transparentPng = await sharp({
    create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

  gifImage = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#000" },
  })
    .gif()
    .toBuffer();

  const width = 1500;
  const height = 1500;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  noisyJpeg = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
});

describe("inspectImage", () => {
  it("detects jpeg and png", async () => {
    expect((await inspectImage(orientation6Jpeg)).format).toBe("jpeg");
    expect((await inspectImage(transparentPng)).format).toBe("png");
  });

  it("rejects non-allowed formats (gif)", async () => {
    await expect(inspectImage(gifImage)).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("rejects non-image bytes with a jpeg magic header", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 0)]);
    await expect(inspectImage(fake)).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});

describe("normalizeForVision", () => {
  it("applies EXIF orientation and strips metadata", async () => {
    const { bytes, mime } = await normalizeForVision(orientation6Jpeg);
    expect(mime).toBe("image/jpeg");
    const meta = await sharp(bytes).metadata();
    // Portrait 100x200 + orientation 6 → 200 wide, 100 tall.
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(bytes.includes(Buffer.from("Exif\0\0", "binary"))).toBe(false);
  });

  it("flattens transparent PNG onto a white background", async () => {
    const { bytes } = await normalizeForVision(transparentPng);
    const meta = await sharp(bytes).metadata();
    expect(meta.hasAlpha).toBe(false);
  });
});

describe("toStoredRecipeImage", () => {
  it("produces a metadata-free JPEG within the 250 KB limit", async () => {
    const { bytes, mime } = await toStoredRecipeImage(noisyJpeg);
    expect(mime).toBe("image/jpeg");
    expect(bytes.length).toBeLessThanOrEqual(250_000);
    const meta = await sharp(bytes).metadata();
    expect(meta.exif).toBeUndefined();
  });
});
