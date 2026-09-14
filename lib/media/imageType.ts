// Claude's vision API only accepts these four. Notably NOT included: HEIC/HEIF
// (the default format iPhones save photos in) — the bug that prompted this
// file: process-image blindly cast file.type to this union without checking,
// so a HEIC upload passed straight through to a cryptic 400 from Anthropic.
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(value: string): value is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(value);
}
