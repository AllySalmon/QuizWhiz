import "server-only";
import { eq } from "drizzle-orm";
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
