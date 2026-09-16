-- Run once. Per-user daily AI/grading call cap (Docs/8-Pivot-Addendum.md §9.3),
-- one shared pool across the three routes that ever call the Claude API
-- (process-image, pilot compare-image, the Settings smoke test) — confirmed
-- with the user rather than assumed, since the addendum's wording alone was
-- ambiguous on shared-vs-per-route.
--
-- New table, not a query over audit_log: this needs an O(1) atomic
-- increment-and-read on every AI-costing request, not a count(*) scan over a
-- general event log. Same SECURITY DEFINER / auth.uid()-derivation
-- discipline as every other RPC in this project (test-records-functions.sql,
-- roster-functions.sql) — the daily cap itself is a hardcoded constant
-- inside the function body, never a caller-supplied parameter, since this
-- function guards a cost/security-relevant decision.

create table if not exists ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table ai_usage_daily enable row level security;

-- Self-host Phase 1 (Docs/8-Pivot-Addendum.md §7): guarded so
-- scripts/setup-database.ts can safely run this on every build.
drop policy if exists "owner has full access" on ai_usage_daily;
create policy "owner has full access" on ai_usage_daily
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Atomic per call: ensures today's row exists, locks it (select ... for
-- update), and only increments if still under the cap — serializes the
-- concurrent requests the client's own upload-worker pool (CONCURRENCY = 3
-- in ScanUploadForm.tsx/PilotRunForm.tsx) can genuinely fire for the same
-- user/day, so the count is exact, never racy, and never climbs past the
-- cap once a user is already at it (kept clean for display purposes).
-- create or replace can't change a function's return type — drop first so
-- re-runs of this file are idempotent regardless of what shape was there
-- before (same precedent as test-records-functions.sql).
drop function if exists public.increment_and_check_ai_usage();

-- returns table uses quoted camelCase output column names, not the
-- unquoted-lowercase default — same reason as every RPC in
-- test-records-functions.sql: supabase-js's .rpc() has no equivalent of
-- .from().select()'s `alias:column` syntax, so an unquoted `current_count`
-- would hand the TS caller raw snake_case instead of the camelCase every
-- other query-layer type in this codebase uses.
create or replace function public.increment_and_check_ai_usage()
returns table (allowed boolean, "currentCount" integer, "dailyCap" integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_cap constant integer := 20;
  v_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into ai_usage_daily (user_id, usage_date, call_count)
  values (v_uid, current_date, 0)
  on conflict (user_id, usage_date) do nothing;

  select ai_usage_daily.call_count into v_count
  from ai_usage_daily
  where ai_usage_daily.user_id = v_uid and ai_usage_daily.usage_date = current_date
  for update;

  if v_count < v_cap then
    update ai_usage_daily
    set call_count = call_count + 1
    where ai_usage_daily.user_id = v_uid and ai_usage_daily.usage_date = current_date;
    v_count := v_count + 1;
    return query select true, v_count, v_cap;
  else
    return query select false, v_count, v_cap;
  end if;
end;
$$;

revoke all on function public.increment_and_check_ai_usage from public;
grant execute on function public.increment_and_check_ai_usage to authenticated;
