import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit is a standalone CLI, not part of the Next.js dev/build process
// that auto-loads .env.local — so it needs to load it explicitly here.
config({ path: ".env.local" });

// lib/env.ts's getters read process.env lazily (at call time, below) rather
// than at import time — the import itself is hoisted above dotenv's
// config() call regardless of source order, but calling the function here
// happens once this module's own top-level code runs, after config().
import { getDirectUrl, getDatabaseUrl } from "./lib/env";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Direct connection (port 5432), not the pooled one: migrations run
    // DDL/advisory-lock behavior that pgbouncer transaction-mode pooling
    // (DATABASE_URL, used at app runtime in lib/db/client.ts) doesn't
    // reliably support. Falls back to Vercel's Supabase integration's
    // POSTGRES_URL_NON_POOLING/POSTGRES_URL names via lib/env.ts.
    url: (getDirectUrl() ?? getDatabaseUrl())!,
  },
});
