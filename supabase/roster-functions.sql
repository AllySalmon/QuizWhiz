-- Run once, alongside roster-rls.sql. Five SECURITY DEFINER RPCs giving the
-- roster's bulk writes real atomicity, same discipline as
-- supabase/test-records-functions.sql: user_id is ALWAYS derived from
-- auth.uid() inside the function body, never taken as or trusted from a
-- parameter, and set search_path = public guards against search_path
-- hijacking of the elevated privilege.
--
-- None of these callers use the return value beyond "did it throw" (checked
-- against every real call site before writing this file) — reassign_and_
-- delete_teacher(s) and delete_student return void; upsert_many_students
-- and delete_many_students return the affected count, matching what
-- studentRoster.ts's originals returned, kept for signature parity even
-- though nothing reads it today.
--
-- reassign_and_delete_teacher(s) add an explicit ownership check before
-- touching anything, even though a forged teacher_id would already be a
-- no-op on the final soft-delete (filtered by user_id) — without the check,
-- a forged id would still get logged into audit_log as if a real deletion
-- happened. Small gap, cheap to close, same "same-class issue, fix it"
-- pattern as this project's earlier Select-label fix.

create or replace function public.reassign_and_delete_teacher(
  p_teacher_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_assignment jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from teachers where teachers.id = p_teacher_id and teachers.user_id = v_uid) then
    raise exception 'teacher not found or not owned by the caller';
  end if;

  for v_assignment in select * from jsonb_array_elements(p_assignments)
  loop
    update student_roster
    set teacher_id = (v_assignment ->> 'newTeacherId')::uuid, updated_at = now()
    where student_number = (v_assignment ->> 'studentNumber') and user_id = v_uid;
  end loop;

  insert into audit_log (user_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'teacher_deleted_reassigned',
    'teacher',
    p_teacher_id::text,
    jsonb_build_object('reassignedCount', jsonb_array_length(p_assignments), 'assignments', p_assignments)
  );

  update teachers set is_active = false, updated_at = now() where id = p_teacher_id and user_id = v_uid;
end;
$$;

revoke all on function public.reassign_and_delete_teacher from public;
grant execute on function public.reassign_and_delete_teacher to authenticated;

create or replace function public.reassign_and_delete_teachers(
  p_teacher_ids uuid[],
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_assignment jsonb;
  v_owned_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_owned_count from teachers where id = any(p_teacher_ids) and user_id = v_uid;
  if v_owned_count <> coalesce(array_length(p_teacher_ids, 1), 0) then
    raise exception 'one or more teachers not found or not owned by the caller';
  end if;

  for v_assignment in select * from jsonb_array_elements(p_assignments)
  loop
    update student_roster
    set teacher_id = (v_assignment ->> 'newTeacherId')::uuid, updated_at = now()
    where student_number = (v_assignment ->> 'studentNumber') and user_id = v_uid;
  end loop;

  insert into audit_log (user_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'teachers_bulk_deleted_reassigned',
    'teacher',
    array_to_string(p_teacher_ids, ','),
    jsonb_build_object(
      'teacherIds', to_jsonb(p_teacher_ids),
      'reassignedCount', jsonb_array_length(p_assignments),
      'assignments', p_assignments
    )
  );

  update teachers set is_active = false, updated_at = now() where id = any(p_teacher_ids) and user_id = v_uid;
end;
$$;

revoke all on function public.reassign_and_delete_teachers from public;
grant execute on function public.reassign_and_delete_teachers to authenticated;

create or replace function public.upsert_many_students(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_row jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into student_roster (user_id, student_number, teacher_id, grade_band)
    values (v_uid, v_row ->> 'studentNumber', (v_row ->> 'teacherId')::uuid, (v_row ->> 'gradeBand')::grade_band)
    on conflict (user_id, student_number)
    do update set teacher_id = excluded.teacher_id, grade_band = excluded.grade_band, updated_at = now();
  end loop;

  return jsonb_array_length(p_rows);
end;
$$;

revoke all on function public.upsert_many_students from public;
grant execute on function public.upsert_many_students to authenticated;

create or replace function public.delete_student(p_student_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from student_roster where student_number = p_student_number and user_id = v_uid;

  insert into audit_log (user_id, action, entity_type, entity_id, details)
  values (v_uid, 'student_deleted', 'student_roster', p_student_number, '{}'::jsonb);
end;
$$;

revoke all on function public.delete_student from public;
grant execute on function public.delete_student to authenticated;

create or replace function public.delete_many_students(p_student_numbers text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from student_roster where student_number = any(p_student_numbers) and user_id = v_uid;

  insert into audit_log (user_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'students_bulk_deleted',
    'student_roster',
    array_to_string(p_student_numbers, ','),
    jsonb_build_object('studentNumbers', to_jsonb(p_student_numbers))
  );

  return coalesce(array_length(p_student_numbers, 1), 0);
end;
$$;

revoke all on function public.delete_many_students from public;
grant execute on function public.delete_many_students to authenticated;
