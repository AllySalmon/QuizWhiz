import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit is a standalone CLI, not part of the Next.js dev/build process
// that auto-loads .env.local — so it needs to load it explicitly here.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Direct connection (port 5432), not the pooled one: migrations run
    // DDL/advisory-lock behavior that pgbouncer transaction-mode pooling
    // (DATABASE_URL, used at app runtime in lib/db/client.ts) doesn't
    // reliably support.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
