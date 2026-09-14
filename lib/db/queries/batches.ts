import "server-only";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../client";
import { batches, testRecords } from "../schema";
import { deleteTestRecord } from "./testRecords";

export async function createBatch(input: { label: string; sourceType: "photo" | "pdf"; itemCount: number }) {
  const db = getDb();
  const [batch] = await db.insert(batches).values(input).returning();
  return batch;
}

export async function getBatch(id: string) {
  const db = getDb();
  const [batch] = await db.select().from(batches).where(eq(batches.id, id));
  return batch ?? null;
}

// Every batch ever uploaded, most recent first — the "where did my scans
// go" list. Full per-teacher grouping/export is Milestone 2 (Reports);
// this is just "find a past batch again."
export async function listBatches() {
  const db = getDb();
  return db.select().from(batches).orderBy(desc(batches.createdAt));
}

// Deletes every test in the batch (each via deleteTestRecord, so book
// reports and scan images are cleaned up the same way a single-record
// delete would), then the batch row itself. Not a single transaction —
// storage deletes are external API calls and can't participate in a DB
// transaction anyway; each test's cleanup is independent and one failing
// doesn't stop the others.
export async function deleteBatch(id: string) {
  const db = getDb();
  const records = await db.select({ id: testRecords.id }).from(testRecords).where(eq(testRecords.batchId, id));

  for (const record of records) {
    await deleteTestRecord(record.id);
  }

  await db.delete(batches).where(eq(batches.id, id));
}
