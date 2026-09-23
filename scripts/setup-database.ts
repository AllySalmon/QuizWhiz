// Self-host Phase 1 (Docs/8-Pivot-Addendum.md §7): "automatic database
// migration" and "automatic storage bucket creation/configuration" on first
// deploy, so a self-hoster never runs a CLI migration command or hand-edits
// SQL themselves. Wired into `build` (package.json) — runs before `next
// build` on every single build, self-host and the public demo alike, not
// just "first deploy": the cheap already-configured check below makes that
// safe, and the seven SQL files applied here are genuinely idempotent (each
// one verified live against the already-configured demo database before
// this script was written, not assumed).
//
// Connects via DIRECT_URL (lib/env.ts, with the Vercel-Supabase-integration
// fallback) — the same non-pooled connection drizzle.config.ts uses, for
// the same reason: DDL/advisory-lock behavior the pooled runtime connection
// (DATABASE_URL) doesn't reliably support.

import { config } from "dotenv";
// This script runs via `tsx` directly (package.json's build script), not
// through Next.js's own process — unlike `next build`, tsx doesn't auto-load
// .env.local, so it's loaded explicitly here, same as drizzle.config.ts.
// A no-op on Vercel: .env.local doesn't exist there (gitignored, never
// deployed) and dotenv's config() just returns quietly when the file is
// missing, leaving process.env exactly as Vercel already populated it.
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDirectUrl, getDatabaseUrl } from "../lib/env";

// Applied in dependency order: each RLS file assumes the user_id columns
// the matching Drizzle migration adds already exist, and roster-rls.sql's
// answer_keys.quiz_code constraint swap assumes answer-keys-rls.sql already
// ran. This is the exact order these were originally hand-applied and
// live-verified in, this session.
const SQL_FILES = [
  "storage-setup.sql",
  "answer-keys-rls.sql",
  "test-records-rls.sql",
  "test-records-functions.sql",
  "roster-rls.sql",
  "roster-functions.sql",
  "ai-usage-cap.sql",
  "pilot-rls.sql",
];

async function main() {
  const connectionString = getDirectUrl() ?? getDatabaseUrl();
  if (!connectionString) {
    console.error(
      "setup-database: no DIRECT_URL/DATABASE_URL (or Vercel-Supabase-integration POSTGRES_URL_NON_POOLING/POSTGRES_URL) found. Skipping — next build will fail on its own if the app genuinely can't reach the database."
    );
    return;
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Cheap already-configured check: ai_usage_daily is the last table
    // added, chronologically — if it exists, every earlier migration/SQL
    // file has already run too.
    const [{ exists }] = await sql<{ exists: boolean }[]>`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'ai_usage_daily'
      ) as exists
    `;

    if (exists) {
      console.log("setup-database: already configured, skipping.");
      return;
    }

    console.log("setup-database: fresh database detected, running full setup...");

    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: join(__dirname, "../lib/db/migrations") });
    console.log("setup-database: Drizzle migrations applied.");

    for (const file of SQL_FILES) {
      const content = readFileSync(join(__dirname, "../supabase", file), "utf8");
      await sql.unsafe(content);
      console.log(`setup-database: applied supabase/${file}`);
    }

    console.log("setup-database: done.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("setup-database failed:", err);
  process.exit(1);
});
