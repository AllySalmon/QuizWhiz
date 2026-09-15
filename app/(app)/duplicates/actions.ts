"use server";

import { redirect } from "next/navigation";
import { deleteManyTestRecords } from "@/lib/db/queries/testRecords";

// Reuses the exact same deletion logic as the batch-scoped bulk delete
// (lib/db/queries/testRecords.ts's deleteManyTestRecords — cascades to
// book reports and scan images per record) — only the redirect target
// differs, since a duplicate set can span multiple batches with no single
// batch to return to.
export async function deleteManyDuplicatesAction(recordIds: string[]) {
  await deleteManyTestRecords(recordIds);
  redirect("/duplicates");
}
