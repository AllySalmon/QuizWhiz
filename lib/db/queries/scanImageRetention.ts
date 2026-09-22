import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteScanImage } from "@/lib/supabase/storage";

// Docs/5-Backend-Schema.md §2.6: scan images are deleted once a test
// record is fully resolved — originally instant (see the removed logic
// this replaces in testRecords.ts's maybeDeleteScanImage), which meant a
// confidently-graded scan's image could vanish before anyone had a chance
// to look at it. This grace period exists so there's a real window to view
// what was scanned (app/(app)/batches/[id]/[recordId]/page.tsx) before the
// same privacy-driven cleanup still happens.
export const SCAN_IMAGE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

type Candidate = {
  id: string;
  scanImageRef: string;
  reviewedAt: string | null;
  createdAt: string;
};

// The only place in the app that reads/writes across every tenant's
// test_records at once — a cron invocation (app/api/cron/cleanup-scan-images/route.ts)
// has no user session, so RLS's per-tenant scoping isn't available, and
// this is deliberately meant to sweep everyone's expired images in one
// pass rather than needing a per-tenant trigger. Uses the admin/service-role
// client, same as every other scan-images bucket operation
// (lib/supabase/storage.ts).
//
// Anchored on reviewed_at when set (a record that went through Grading or
// Assignment Review — the real moment it became resolved) and falls back
// to created_at otherwise (a record that was clean from the start, where
// resolution effectively happened at creation). Using created_at for both
// cases would delete a just-resolved, days-old reviewed record instantly,
// defeating the grace period for exactly the records that most needed
// review time in the first place.
//
// Safe to invoke more than once — idempotent and reconciliation-based
// (Vercel's own cron guidance: delivery is best-effort and can double-fire).
// A record already past the grace window but already cleaned up simply
// won't match the scan_image_ref-not-null filter on the next run.
export async function sweepExpiredScanImages() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("test_records")
    .select("id, scanImageRef:scan_image_ref, reviewedAt:reviewed_at, createdAt:created_at")
    .not("scan_image_ref", "is", null)
    .in("grading_status", ["clean", "resolved"])
    .in("assignment_status", ["clean", "resolved"])
    .returns<Candidate[]>();
  if (error) throw error;

  const now = Date.now();
  const expired = (data ?? []).filter((row) => {
    const resolvedAt = row.reviewedAt ?? row.createdAt;
    return now - new Date(resolvedAt).getTime() >= SCAN_IMAGE_GRACE_PERIOD_MS;
  });

  let deleted = 0;
  for (const row of expired) {
    await deleteScanImage(row.scanImageRef).catch(() => {
      // Already gone — fine to continue clearing the reference below.
    });

    const { error: updateError } = await admin
      .from("test_records")
      .update({ scan_image_ref: null })
      .eq("id", row.id);
    if (updateError) throw updateError;

    deleted++;
  }

  return deleted;
}
