import "server-only";
import { createClient } from "@/lib/supabase/server";
import { deleteTestRecord } from "./testRecords";

// Phase 2 of the RLS conversion — same reasoning as testRecords.ts/answerKeys.ts.

type BatchRow = {
  id: string;
  label: string;
  sourceType: "photo" | "pdf";
  itemCount: number;
  createdAt: string;
};

const BATCH_COLUMNS = "id, label, sourceType:source_type, itemCount:item_count, createdAt:created_at";

export async function createBatch(input: { label: string; sourceType: "photo" | "pdf"; itemCount: number }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batches")
    .insert({ label: input.label, source_type: input.sourceType, item_count: input.itemCount })
    .select(BATCH_COLUMNS)
    .single<BatchRow>();
  if (error) throw error;
  return data;
}

export async function getBatch(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLUMNS)
    .eq("id", id)
    .maybeSingle<BatchRow>();
  if (error) throw error;
  return data ?? null;
}

// Every batch ever uploaded, most recent first — the "where did my scans
// go" list. Full per-teacher grouping/export is Milestone 2 (Reports);
// this is just "find a past batch again."
export async function listBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<BatchRow[]>();
  if (error) throw error;
  return data ?? [];
}

// Deletes every test in the batch (each via deleteTestRecord, so book
// reports and scan images are cleaned up the same way a single-record
// delete would), then the batch row itself. Not a single transaction —
// storage deletes are external API calls and can't participate in a DB
// transaction anyway; each test's cleanup is independent and one failing
// doesn't stop the others.
export async function deleteBatch(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select("id")
    .eq("batch_id", id)
    .returns<{ id: string }[]>();
  if (error) throw error;

  for (const record of data ?? []) {
    await deleteTestRecord(record.id);
  }

  const { error: deleteError } = await supabase.from("batches").delete().eq("id", id);
  if (deleteError) throw deleteError;
}
