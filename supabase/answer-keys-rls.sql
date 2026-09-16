-- Run once, same precedent as storage-setup.sql: not managed by Drizzle,
-- because it references auth.users (a schema Drizzle doesn't model here)
-- and creates RLS policies (which drizzle-kit's schema DSL doesn't express).
--
-- Multi-tenant proof of concept, scoped to answer_keys/answer_key_questions
-- only (see the approved plan). user_id was added nullable via a normal
-- Drizzle migration (0003_clammy_roulette.sql) and backfilled to the
-- existing dev account first — this file finishes the job: makes it
-- required, ties it to a real auth user, defaults it to whoever's making
-- the request, and turns on RLS.
--
-- quiz_code deliberately stays globally unique (not touched here) — see
-- the plan for why: testRecords.ts's and bookReports.ts's leftJoin(quiz_code)
-- sites are still correct only because a value-match can resolve to exactly
-- one row today. Relaxing that waits for those join sites to be scoped too.

-- Self-host Phase 1 (Docs/8-Pivot-Addendum.md §7): made idempotent so
-- scripts/setup-database.ts can safely run this on every build, not just
-- the first. alter column set not null/set default and enable row level
-- security are already no-ops on a second run; add constraint and create
-- policy are not, guarded below.

alter table answer_keys alter column user_id set not null;
do $$ begin
  alter table answer_keys add constraint answer_keys_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null;
end $$;
alter table answer_keys alter column user_id set default auth.uid();

alter table answer_key_questions alter column user_id set not null;
do $$ begin
  alter table answer_key_questions add constraint answer_key_questions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
exception when duplicate_object then null;
end $$;
alter table answer_key_questions alter column user_id set default auth.uid();

alter table answer_keys enable row level security;

drop policy if exists "owner has full access" on answer_keys;
create policy "owner has full access" on answer_keys
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table answer_key_questions enable row level security;

drop policy if exists "owner has full access" on answer_key_questions;
create policy "owner has full access" on answer_key_questions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
