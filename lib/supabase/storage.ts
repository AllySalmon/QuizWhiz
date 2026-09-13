import "server-only";
import { createAdminClient } from "./admin";

// All access to the scan-images bucket goes through here, using the
// service-role client — the bucket is private (supabase/storage-setup.sql)
// and has no policies granting the browser client any access at all.
// Signed URLs are short-lived and generated server-side only, e.g. when
// rendering a Review Queue item's scan image (Milestone 1).

const BUCKET = "scan-images";

export async function uploadScanImage(path: string, file: Buffer, contentType: string) {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType });
  if (error) throw error;
  return path;
}

export async function getSignedScanImageUrl(path: string, expiresInSeconds = 300) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteScanImage(path: string) {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
