import "server-only";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../client";
import { batches } from "../schema";

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
