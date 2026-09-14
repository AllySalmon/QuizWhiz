"use client";

// Browser-only, best-effort. Tries to re-encode an image into a smaller
// JPEG before upload — pure optimization (upload size, mainly), never a
// correctness requirement, because browsers can't decode every format a
// scanner or phone might produce (TIFF: no browser ever decodes it; HEIC:
// only Safari does). The server does the format work that actually has to
// succeed, via sharp/libvips (lib/media/serverNormalize.ts), which handles
// TIFF, HEIC, and everything else uniformly regardless of the browser.
//
// So: if the browser CAN decode it, we get a smaller/faster upload for
// free. If it can't, we just upload the original bytes unchanged and let
// the server convert them — never block or fail the upload here.
export async function tryNormalizeImageForUpload(
  file: File,
  { maxDimension = 2000, quality = 0.85 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Browser couldn't decode this format (e.g. TIFF, or HEIC outside
    // Safari) — fall back to the original file, unchanged.
    return file;
  }
}
