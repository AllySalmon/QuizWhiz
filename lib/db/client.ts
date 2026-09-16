import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrl } from "../env";

// Lazily created so this module can be imported without a DATABASE_URL
// present (e.g. during build) and only fails when actually queried.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set (and no POSTGRES_URL fallback from Vercel's Supabase integration either). Copy .env.local.example to .env.local and fill it in."
    );
  }

  // Supabase's pooled connection (pgbouncer) doesn't support prepared
  // statements, which postgres-js uses by default.
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}
