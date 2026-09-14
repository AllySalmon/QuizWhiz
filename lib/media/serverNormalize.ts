import "server-only";
import sharp from "sharp";

// The one place format actually has to work, regardless of what the
// browser could or couldn't do client-side. libvips (via sharp) reads
// JPEG/PNG/WEBP/GIF/TIFF and, on most platforms, HEIC/HEIF uniformly — far
// broader and more reliable than browser <canvas> decoding, which can't
// touch TIFF at all and only handles HEIC on Safari.
//
// .rotate() with no args applies EXIF auto-orientation — phone photos
// often store rotation as metadata rather than physically rotating pixels;
// without this they can arrive sideways.
export async function normalizeImageBuffer(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().jpeg({ quality: 88 }).toBuffer();
  } catch (error) {
    throw new Error(
      `Couldn't read this image — it may be corrupted or in a format we don't support. (${
        error instanceof Error ? error.message : "unknown error"
      })`
    );
  }
}
