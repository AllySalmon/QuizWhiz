-- Run once, same precedent as storage-setup.sql/answer-keys-rls.sql/
-- test-records-rls.sql: not managed by Drizzle, because it references
-- auth.users, creates RLS policies, and restructures primary keys/unique
-- constraints — all things drizzle-kit's schema DSL either can't express or
-- that we deliberately don't want it managing.
--
-- Phase 3 of the RLS conversion (see the approved plan): teachers/
-- student_roster. user_id was added nullable via a normal Drizzle migration
-- (0005_wise_the_professor.sql) and backfilled to the existing dev account
-- first — this file finishes the job, and additionally relaxes the two
-- uniqueness constraints that assumed a single global tenant:
--   - student_roster's primary key moves from student_number alone to
--     (user_id, student_number) — no surrogate id added, since nothing
--     references student_roster by FK (confirmed by grep before this pass).
--   - answer_keys.quiz_code's unique constraint moves from a bare UNIQUE
--     (quiz_code) to UNIQUE (user_id, quiz_code) — deferred from the phase 1
--     PoC specifically until this pass, once testRecords.ts/bookReports.ts's
--     value-match joins were confirmed RLS-scoped on both sides (phase 2).
-- Real constraint names confirmed live via pg_constraint before writing
-- this file, not assumed from Postgres's default naming convention.

alter table teachers
  alter column user_id set not null,
  add constraint teachers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table teachers enable row level security;

create policy "owner has full access" on teachers
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table student_roster
  alter column user_id set not null,
  add constraint student_roster_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  alter column user_id set default auth.uid();

alter table student_roster drop constraint student_roster_pkey;
alter table student_roster add primary key (user_id, student_number);

alter table student_roster enable row level security;

create policy "owner has full access" on student_roster
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table answer_keys drop constraint answer_keys_quiz_code_unique;
alter table answer_keys add constraint answer_keys_user_id_quiz_code_unique unique (user_id, quiz_code);
