"use client";

// Browser-only. Re-encodes any image the browser can decode into a
// reasonably-sized JPEG before upload. Two problems solved at once:
// 1. Format: guarantees output Claude's vision API accepts (fixes the HEIC
//    bug — iPhones save photos in HEIC by default, which isn't one of the
//    four types Claude supports; Safari can decode HEIC into a canvas, so
//    re-encoding fixes it there transparently).
// 2. Size: caps the longest edge and JPEG quality, satisfying the "compress
//    client-side" requirement from Docs/7-Mobile-Implementation.md §3 (a
//    200-photo batch over slow library Wi-Fi shouldn't stall on upload).
//
// If the browser can't decode the source format at all (e.g. Chrome on
// Windows generally can't decode HEIC — it's Apple's codec, not a web
// standard), this throws; callers should catch it and surface a clear
// per-file message rather than letting the batch silently stall.
export async function normalizeImageForUpload(
  file: File,
  { maxDimension = 2000, quality = 0.85 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      `Couldn't read "${file.name}" — this browser may not support its format. Try re-saving it as JPG or PNG first.`
    );
  });

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support the image processing QuizWhiz needs.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`Couldn't process "${file.name}".`))),
      "image/jpeg",
      quality
    );
  });

  const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
