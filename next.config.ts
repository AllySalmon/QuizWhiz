import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly — without this, Turbopack can infer
  // the wrong root if a stray lockfile exists higher up the filesystem.
  turbopack: {
    root: path.join(__dirname),
  },
  // Maps Vercel's native Supabase integration's key name
  // (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, confirmed via Supabase's own
  // docs) onto the name this app actually reads, so a self-host deployer
  // using the "Deploy to Vercel" button never has to manually rename
  // anything. This project's own value (set manually, or already present on
  // the public demo) always wins. `env` inlines into the client bundle at
  // build time — correct here since this is the public anon key, not a
  // secret; the server-only equivalents (service role key, DB URLs) are
  // resolved in lib/env.ts instead, specifically to avoid that inlining.
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
};

export default nextConfig;
