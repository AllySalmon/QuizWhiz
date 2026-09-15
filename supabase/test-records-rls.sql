-- Run once, same precedent as storage-setup.sql/answer-keys-rls.sql: not
-- managed by Drizzle, because it references auth.users (a schema Drizzle
-- doesn't model here) and creates RLS policies (which drizzle-kit's schema
-- DSL doesn't express).
--
-- Phase 2 of the RLS conversion: batches/test_records/book_reports/audit_log
-- (see the approved plan). user_id was added nullable via a normal Drizzle
-- migration (0004_lame_tyrannus.sql) and backfilled to the existing dev
-- account first — this file finishes the job: makes it required, ties it to
-- a real auth user, defaults it to whoever's making the request, and turns
-- on RLS.
--
-- teachers/student_roster are NOT touched here (next pass) — test_records'
-- and book_reports' joins to teachers still pull from a currently-global,
-- unscoped teachers table until then. Not a regression, just not "done" yet.
--
-- quiz_code/student_number stay globally unique, unchanged — the value-match
-- join sites in testRecords.ts/bookReports.ts are still only correct because
-- of that. Relaxing it waits for the teachers/student_roster pass.

alter table batches
  alter column user_id set not null,
  add constraint batches_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table test_records
  alter column user_id set not null,
  add constraint test_records_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table book_reports
  alter column user_id set not null,
  add constraint book_reports_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table audit_log
  alter column user_id set not null,
  add constraint audit_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table batches enable row level security;

create policy "owner has full access" on batches
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table test_records enable row level security;

create policy "owner has full access" on test_records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table book_reports enable row level security;

create policy "owner has full access" on book_reports
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table audit_log enable row level security;

create policy "owner has full access" on audit_log
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
