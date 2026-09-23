-- comparison_runs / comparison_run_items (lib/db/schema.ts) are Pilot's own
-- accuracy-testing tables (app/(app)/pilot) — not part of the tenant model,
-- so unlike every other table here, this deliberately adds NO policies.
-- The app only ever reaches these through lib/db/client.ts's direct
-- Postgres connection (the `postgres` role, which bypasses RLS), same as
-- every other table's app-side access — so enabling RLS with zero policies
-- costs the app nothing, and closes exactly what Supabase's Security
-- Advisor flagged: with RLS off, PostgREST serves unrestricted read/write/
-- delete on these tables to anyone holding the project's public anon key
-- (shipped in every client bundle by design), regardless of whether
-- they're signed in. No policies + RLS enabled = default-deny for the
-- anon/authenticated roles PostgREST actually runs as; the app's own
-- privileged connection is unaffected either way.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is itself idempotent — no
-- DO $$ guard needed, unlike the CREATE POLICY/constraint statements in
-- this directory's other files.

alter table comparison_runs enable row level security;
alter table comparison_run_items enable row level security;
