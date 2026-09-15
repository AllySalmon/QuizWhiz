-- Run once, alongside test-records-rls.sql. Three SECURITY DEFINER RPCs
-- giving the three multi-table test_records writes real atomicity, since
-- @supabase/supabase-js has no multi-statement transaction primitive (see
-- the approved plan for why this table needs that and answer_keys didn't).
--
-- Load-bearing safety rule for every function below: user_id is ALWAYS
-- derived from auth.uid() inside the function body, never taken as or
-- trusted from a parameter. SECURITY DEFINER runs with the function owner's
-- privileges (bypassing the caller's RLS), so every ownership check has to
-- be done explicitly, by hand, inside the body — there is no RLS safety net
-- inside a SECURITY DEFINER function the way there is for an ordinary
-- PostgREST request. set search_path = public on each function prevents a
-- search_path-hijacking attack against that elevated privilege.
--
-- No existing precedent for this exact shape in the sibling projects
-- (Procure Master's one real RPC is cron-only, called by the admin client,
-- and never re-checks ownership because nothing untrusted ever calls it) —
-- these are callable by an arbitrary authenticated user, so the check here
-- is the real thing, not borrowed from an example.
--
-- Each function declares `returns table (...)` with quoted camelCase column
-- names, not `returns test_records` — supabase-js's .rpc() has no equivalent
-- of .from().select()'s `alias:column` string syntax, so a plain table-typed
-- return would hand the query layer raw snake_case columns and silently
-- break every TypeScript type in lib/db/queries/testRecords.ts that expects
-- camelCase. Returning the shape the caller actually wants, explicitly, from
-- the database is simpler than translating it a second time in JS.

-- create or replace can't change a function's return type (e.g. a prior run
-- of this file with a plain `returns test_records`) — drop first so re-runs
-- of this file are idempotent regardless of what shape was there before.
drop function if exists public.create_graded_test_record(uuid, integer, text, text, text, uuid, jsonb, numeric, boolean, grading_status, assignment_status, jsonb, text);
drop function if exists public.sync_test_record_grading(uuid, text, jsonb, numeric, boolean, grading_status, jsonb);
drop function if exists public.correct_test_record_assignment(uuid, text, uuid);

-- Replaces createTestRecord() + the conditional createBookReport() call in
-- app/api/grading/process-image/route.ts. Verifies the batch is actually
-- owned by the caller before inserting — required because SECURITY DEFINER
-- bypasses the RLS that would otherwise catch a forged/cross-tenant batch_id.
create or replace function public.create_graded_test_record(
  p_batch_id uuid,
  p_scan_order integer,
  p_quiz_code text,
  p_student_number text,
  p_ocr_teacher_last_name text,
  p_resolved_teacher_id uuid,
  p_answers_json jsonb,
  p_score_percent numeric,
  p_passed boolean,
  p_grading_status grading_status,
  p_assignment_status assignment_status,
  p_flag_reasons jsonb,
  p_scan_image_ref text
)
returns table (
  id uuid,
  "batchId" uuid,
  "scanOrder" integer,
  "quizCode" text,
  "studentNumber" text,
  "ocrTeacherLastName" text,
  "resolvedTeacherId" uuid,
  "answersJson" jsonb,
  "scorePercent" numeric,
  passed boolean,
  "gradingStatus" grading_status,
  "assignmentStatus" assignment_status,
  "flagReasons" jsonb,
  "scanImageRef" text,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from batches where batches.id = p_batch_id and batches.user_id = v_uid) then
    raise exception 'batch not found or not owned by the caller';
  end if;

  insert into test_records (
    user_id, batch_id, scan_order, quiz_code, student_number,
    ocr_teacher_last_name, resolved_teacher_id, answers_json,
    score_percent, passed, grading_status, assignment_status,
    flag_reasons, scan_image_ref
  ) values (
    v_uid, p_batch_id, p_scan_order, p_quiz_code, p_student_number,
    p_ocr_teacher_last_name, p_resolved_teacher_id, p_answers_json,
    p_score_percent, p_passed, p_grading_status, p_assignment_status,
    p_flag_reasons, p_scan_image_ref
  )
  returning test_records.id into v_id;

  if p_passed is false then
    insert into book_reports (user_id, test_record_id, student_number, teacher_id, due_date)
    select v_uid, v_id, coalesce(test_records.student_number, ''), test_records.resolved_teacher_id, current_date
    from test_records where test_records.id = v_id;
  end if;

  return query
  select
    test_records.id, test_records.batch_id, test_records.scan_order, test_records.quiz_code,
    test_records.student_number, test_records.ocr_teacher_last_name, test_records.resolved_teacher_id,
    test_records.answers_json, test_records.score_percent, test_records.passed,
    test_records.grading_status, test_records.assignment_status, test_records.flag_reasons,
    test_records.scan_image_ref, test_records.reviewed_at, test_records.created_at
  from test_records where test_records.id = v_id;
end;
$$;

revoke all on function public.create_graded_test_record from public;
grant execute on function public.create_graded_test_record to authenticated;

-- Replaces scoreAgainstKey()'s update + syncBookReportOnScoreChange(), used
-- by correctQuizCode()/correctAnswers() (Grading Review corrections).
create or replace function public.sync_test_record_grading(
  p_id uuid,
  p_quiz_code text,
  p_answers_json jsonb,
  p_score_percent numeric,
  p_passed boolean,
  p_grading_status grading_status,
  p_flag_reasons jsonb
)
returns table (
  id uuid,
  "batchId" uuid,
  "scanOrder" integer,
  "quizCode" text,
  "studentNumber" text,
  "ocrTeacherLastName" text,
  "resolvedTeacherId" uuid,
  "answersJson" jsonb,
  "scorePercent" numeric,
  passed boolean,
  "gradingStatus" grading_status,
  "assignmentStatus" assignment_status,
  "flagReasons" jsonb,
  "scanImageRef" text,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_passed boolean;
  v_student_number text;
  v_resolved_teacher_id uuid;
  v_existing_report_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update test_records
  set
    quiz_code = p_quiz_code,
    answers_json = p_answers_json,
    score_percent = p_score_percent,
    passed = p_passed,
    grading_status = p_grading_status,
    flag_reasons = p_flag_reasons,
    reviewed_at = now()
  where test_records.id = p_id and test_records.user_id = v_uid
  returning test_records.passed, test_records.student_number, test_records.resolved_teacher_id
  into v_passed, v_student_number, v_resolved_teacher_id;

  if not found then
    raise exception 'test record not found or not owned by the caller';
  end if;

  select book_reports.id into v_existing_report_id from book_reports where book_reports.test_record_id = p_id;

  -- Mirrors syncBookReportOnScoreChange's "passed !== false" / "passed === false"
  -- JS semantics exactly via SQL's null-safe IS [NOT] FALSE.
  if v_passed is false and v_existing_report_id is null then
    insert into book_reports (user_id, test_record_id, student_number, teacher_id, due_date)
    values (v_uid, p_id, coalesce(v_student_number, ''), v_resolved_teacher_id, current_date);
  elsif v_passed is not false and v_existing_report_id is not null then
    delete from book_reports where book_reports.id = v_existing_report_id;
  end if;

  return query
  select
    test_records.id, test_records.batch_id, test_records.scan_order, test_records.quiz_code,
    test_records.student_number, test_records.ocr_teacher_last_name, test_records.resolved_teacher_id,
    test_records.answers_json, test_records.score_percent, test_records.passed,
    test_records.grading_status, test_records.assignment_status, test_records.flag_reasons,
    test_records.scan_image_ref, test_records.reviewed_at, test_records.created_at
  from test_records where test_records.id = p_id;
end;
$$;

revoke all on function public.sync_test_record_grading from public;
grant execute on function public.sync_test_record_grading to authenticated;

-- Replaces correctAssignment()'s db.transaction (update + audit_log insert).
-- Also folds in the book-report teacher sync that previously ran as a
-- separate, non-atomic call right after that transaction — closing the same
-- class of "silent miss on the join table" gap one level down.
create or replace function public.correct_test_record_assignment(
  p_id uuid,
  p_student_number text,
  p_teacher_id uuid
)
returns table (
  id uuid,
  "batchId" uuid,
  "scanOrder" integer,
  "quizCode" text,
  "studentNumber" text,
  "ocrTeacherLastName" text,
  "resolvedTeacherId" uuid,
  "answersJson" jsonb,
  "scorePercent" numeric,
  passed boolean,
  "gradingStatus" grading_status,
  "assignmentStatus" assignment_status,
  "flagReasons" jsonb,
  "scanImageRef" text,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_prev_student_number text;
  v_prev_teacher_id uuid;
  v_prev_assignment_status assignment_status;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select test_records.student_number, test_records.resolved_teacher_id, test_records.assignment_status
  into v_prev_student_number, v_prev_teacher_id, v_prev_assignment_status
  from test_records where test_records.id = p_id and test_records.user_id = v_uid;

  if not found then
    raise exception 'test record not found or not owned by the caller';
  end if;

  update test_records
  set
    student_number = p_student_number,
    resolved_teacher_id = p_teacher_id,
    assignment_status = 'resolved',
    reviewed_at = now()
  where test_records.id = p_id and test_records.user_id = v_uid;

  insert into audit_log (user_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'test_record_assignment_corrected',
    'test_record',
    p_id::text,
    jsonb_build_object(
      'previousStudentNumber', v_prev_student_number,
      'newStudentNumber', p_student_number,
      'previousTeacherId', v_prev_teacher_id,
      'newTeacherId', p_teacher_id,
      'wasAlreadyResolved', v_prev_assignment_status = 'resolved'
    )
  );

  update book_reports set teacher_id = p_teacher_id where book_reports.test_record_id = p_id;

  return query
  select
    test_records.id, test_records.batch_id, test_records.scan_order, test_records.quiz_code,
    test_records.student_number, test_records.ocr_teacher_last_name, test_records.resolved_teacher_id,
    test_records.answers_json, test_records.score_percent, test_records.passed,
    test_records.grading_status, test_records.assignment_status, test_records.flag_reasons,
    test_records.scan_image_ref, test_records.reviewed_at, test_records.created_at
  from test_records where test_records.id = p_id;
end;
$$;

revoke all on function public.correct_test_record_assignment from public;
grant execute on function public.correct_test_record_assignment to authenticated;
