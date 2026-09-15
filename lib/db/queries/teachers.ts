import "server-only";
import { createClient } from "@/lib/supabase/server";

// Phase 3 of the RLS conversion (see the approved plan): this file queries
// through the Supabase client (PostgREST), not Drizzle — same reasoning as
// every prior phase (rolbypassrls=true on the Drizzle connection).
// reassignAndDeleteTeacher(s) call Postgres RPCs (supabase/roster-functions.sql)
// for the same reason test_records/book_reports' multi-statement writes did:
// supabase-js has no transaction primitive, and these do a bulk
// student_roster update + audit_log insert + teacher soft-delete together.
//
// createdAt/updatedAt come back as ISO strings, not Date objects (see
// answerKeys.ts for the same note).

type TeacherRow = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const TEACHER_COLUMNS = "id, firstName:first_name, lastName:last_name, isActive:is_active, createdAt:created_at, updatedAt:updated_at";

// studentCount comes from a second query, not a PostgREST aggregate embed —
// small data volume (a school's own roster), and keeps this consistent with
// the "merge in JS" pattern used throughout the query layer instead of
// relying on PostgREST's less-common count-embed syntax.
export async function listTeachersWithStudentCounts() {
  const supabase = await createClient();
  const [teachersRes, rosterRes] = await Promise.all([
    supabase
      .from("teachers")
      .select("id, firstName:first_name, lastName:last_name")
      .eq("is_active", true)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .returns<{ id: string; firstName: string; lastName: string }[]>(),
    supabase.from("student_roster").select("teacherId:teacher_id").returns<{ teacherId: string | null }[]>(),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (rosterRes.error) throw rosterRes.error;

  const counts = new Map<string, number>();
  for (const r of rosterRes.data ?? []) {
    if (r.teacherId) counts.set(r.teacherId, (counts.get(r.teacherId) ?? 0) + 1);
  }
  return (teachersRes.data ?? []).map((t) => ({ ...t, studentCount: counts.get(t.id) ?? 0 }));
}

export async function listActiveTeachers(excludeId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("teachers")
    .select("id, firstName:first_name, lastName:last_name")
    .eq("is_active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.returns<{ id: string; firstName: string; lastName: string }[]>();
  if (error) throw error;
  return data ?? [];
}

// Bulk-delete variant of listActiveTeachers: excludes every teacher being
// deleted in the same operation (so none of them can be picked as a
// reassignment target for each other's students).
export async function listActiveTeachersExcluding(excludeIds: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("teachers")
    .select("id, firstName:first_name, lastName:last_name")
    .eq("is_active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await query.returns<{ id: string; firstName: string; lastName: string }[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getTeachersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("teachers").select(TEACHER_COLUMNS).in("id", ids).returns<TeacherRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getTeacher(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teachers").select(TEACHER_COLUMNS).eq("id", id).maybeSingle<TeacherRow>();
  if (error) throw error;
  return data ?? null;
}

// Case-insensitive exact match on both names, active teachers only.
// excludeId lets renameTeacher check "does this name match anyone ELSE".
export async function findTeacherByFullName(firstName: string, lastName: string, excludeId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("teachers")
    .select("id, firstName:first_name, lastName:last_name")
    .eq("is_active", true)
    .ilike("first_name", firstName.trim())
    .ilike("last_name", lastName.trim());
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.maybeSingle<{ id: string; firstName: string; lastName: string }>();
  if (error) throw error;
  return data ?? null;
}

export async function createTeacher(input: { firstName: string; lastName: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .insert({ first_name: input.firstName, last_name: input.lastName })
    .select(TEACHER_COLUMNS)
    .single<TeacherRow>();
  if (error) throw error;
  return data;
}

// Used by the CSV import (lib/csv/teacherImport.ts) after it has already
// filtered out missing-name and duplicate rows (against both the existing
// roster and other rows in the same file). One batched insert, still atomic
// as a single statement — no RPC needed.
export async function createManyTeachers(rows: { firstName: string; lastName: string }[]) {
  if (rows.length === 0) return 0;
  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .insert(rows.map((r) => ({ first_name: r.firstName, last_name: r.lastName })));
  if (error) throw error;
  return rows.length;
}

// Rename cascades for free — every FK reference (student_roster.teacher_id,
// test_records.resolved_teacher_id, book_reports.teacher_id) points at the
// same row id, so no downstream update is needed (Docs/1-PRD.md §5.8).
export async function renameTeacher(id: string, input: { firstName: string; lastName: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .update({ first_name: input.firstName, last_name: input.lastName, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(TEACHER_COLUMNS)
    .single<TeacherRow>();
  if (error) throw error;
  return data;
}

export async function getStudentsForTeacher(teacherId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_roster")
    .select("studentNumber:student_number, gradeBand:grade_band")
    .eq("teacher_id", teacherId)
    .order("student_number", { ascending: true })
    .returns<{ studentNumber: string; gradeBand: "jr" | "3-5" }[]>();
  if (error) throw error;
  return data ?? [];
}

// Bulk-delete variant: every student currently assigned to ANY of the
// listed teachers, so a multi-teacher deletion shows one combined
// reassignment screen instead of one per teacher.
export async function getStudentsForTeachers(teacherIds: string[]) {
  if (teacherIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_roster")
    .select("studentNumber:student_number, gradeBand:grade_band, teacherId:teacher_id")
    .in("teacher_id", teacherIds)
    .order("student_number", { ascending: true })
    .returns<{ studentNumber: string; gradeBand: "jr" | "3-5"; teacherId: string | null }[]>();
  if (error) throw error;
  return data ?? [];
}

// Atomic via the reassign_and_delete_teacher RPC (supabase/roster-functions.sql):
// reassigns every listed student, logs the action, then soft-deletes the
// teacher, all in one Postgres transaction — per Docs/1-PRD.md §5.8
// ("deletion is blocked until every student has been reassigned").
export async function reassignAndDeleteTeacher(
  teacherId: string,
  assignments: { studentNumber: string; newTeacherId: string }[]
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reassign_and_delete_teacher", {
    p_teacher_id: teacherId,
    p_assignments: assignments,
  });
  if (error) throw error;
}

// Bulk variant of reassignAndDeleteTeacher: reassigns students across ALL
// listed teachers, then soft-deletes all of them, atomically via the
// reassign_and_delete_teachers RPC.
export async function reassignAndDeleteTeachers(
  teacherIds: string[],
  assignments: { studentNumber: string; newTeacherId: string }[]
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reassign_and_delete_teachers", {
    p_teacher_ids: teacherIds,
    p_assignments: assignments,
  });
  if (error) throw error;
}

export async function teachersExist() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teachers").select("id").eq("is_active", true).limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
