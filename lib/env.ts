// Resolves the server-only secrets this app reads against two possible
// naming schemes: this project's own (set manually, or already present on
// the public demo's Vercel project) and Vercel's native Supabase
// marketplace integration's (POSTGRES_URL / POSTGRES_URL_NON_POOLING /
// SUPABASE_SECRET_KEY — confirmed via Supabase's own docs, not guessed).
// A self-host deployer using the integration's "Deploy to Vercel" button
// never has to manually rename anything; this project's own names always
// win when both are present (e.g. the existing demo project, or anyone who
// set things up by hand per .env.local.example).
//
// Deliberately functions, not eagerly-evaluated consts: drizzle.config.ts
// loads .env.local via dotenv's config() call at its own module top level,
// and ES module imports are hoisted — they evaluate before any of the
// importing file's own top-level statements run, regardless of where the
// `import` line sits in the source. An eager `export const X =
// process.env.X` here would have read process.env before dotenv populated
// it. Reading inside a function defers the read to call time, after
// dotenv's config() has already run.
//
// Deliberately NOT used for the two NEXT_PUBLIC_* values — those are
// resolved in next.config.ts's `env` key instead, since that mechanism
// inlines values into the client bundle at build time. Using it for a
// server-only secret like this would leak it into client-side JS.

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

export function getDirectUrl() {
  return process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}
