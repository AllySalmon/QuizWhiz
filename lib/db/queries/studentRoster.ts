import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GradeBand } from "./answerKeys";

// Phase 3 of the RLS conversion — same reasoning as teachers.ts. Search and
// sort (grade band jr-before-3-5, then teacher last name, then student
// number) happen in JS after an RLS-scoped fetch rather than via PostgREST
// filters/order — the grade-band ordering is a custom two-value rule
// PostgREST's .order() can't express, and filtering the embedded teachers
// resource's last_name alongside student_number in one .or() isn't reliably
// supported either. Small data volume (a school's own roster) makes this a
// reasonable tradeoff, same one already made for searchAnswerKeys()/
// listPossibleDuplicates() elsewhere in this query layer.

type StudentRow = {
  studentNumber: string;
  gradeBand: GradeBand;
  teacherId: string | null;
  teachers: { firstName: string; lastName: string } | null;
};

const GRADE_RANK: Record<GradeBand, number> = { jr: 0, "3-5": 1 };

function sortStudents<T extends { gradeBand: GradeBand; teacherLastName: string | null; studentNumber: string }>(
  rows: T[]
) {
  return rows.sort(
    (a, b) =>
      GRADE_RANK[a.gradeBand] - GRADE_RANK[b.gradeBand] ||
      (a.teacherLastName ?? "￿").localeCompare(b.teacherLastName ?? "￿") ||
      a.studentNumber.localeCompare(b.studentNumber)
  );
}

export async function listStudents(search?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_roster")
    .select("studentNumber:student_number, gradeBand:grade_band, teacherId:teacher_id, teachers(firstName:first_name, lastName:last_name)")
    .returns<StudentRow[]>();
  if (error) throw error;

  const flattened = (data ?? []).map((r) => ({
    studentNumber: r.studentNumber,
    gradeBand: r.gradeBand,
    teacherId: r.teacherId,
    teacherFirstName: r.teachers?.firstName ?? null,
    teacherLastName: r.teachers?.lastName ?? null,
  }));

  const filtered = search
    ? flattened.filter(
        (s) =>
          s.studentNumber.toLowerCase().includes(search.toLowerCase()) ||
          (s.teacherLastName?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : flattened;

  return sortStudents(filtered);
}

export async function getStudent(studentNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_roster")
    .select("studentNumber:student_number, gradeBand:grade_band, teacherId:teacher_id")
    .eq("student_number", studentNumber)
    .maybeSingle<{ studentNumber: string; gradeBand: GradeBand; teacherId: string | null }>();
  if (error) throw error;
  return data ?? null;
}

export async function upsertStudent(input: { studentNumber: string; teacherId: string; gradeBand: GradeBand }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_roster")
    .upsert(
      { student_number: input.studentNumber, teacher_id: input.teacherId, grade_band: input.gradeBand },
      { onConflict: "user_id,student_number" }
    )
    .select("studentNumber:student_number, gradeBand:grade_band, teacherId:teacher_id")
    .single<{ studentNumber: string; gradeBand: GradeBand; teacherId: string | null }>();
  if (error) throw error;
  return data;
}

// Used by the CSV import (lib/csv/studentRosterImport.ts) after it has
// already resolved each row's teacher and validated the grade band. Atomic
// via the upsert_many_students RPC (supabase/roster-functions.sql) —
// supabase-js has no multi-statement transaction primitive.
export async function upsertManyStudents(rows: { studentNumber: string; teacherId: string; gradeBand: GradeBand }[]) {
  if (rows.length === 0) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_many_students", { p_rows: rows });
  if (error) throw error;
  return data as number;
}

// Hard delete — student_roster has no soft-delete flag (unlike teachers).
// Safe against the schema: test_records/book_reports reference student_number
// by value, not a FK (Docs/5-Backend-Schema.md §3), so historical records
// survive and simply become "not in the roster" again if referenced later —
// the same state a never-added student is already in. Atomic (delete +
// audit_log insert) via the delete_student RPC.
export async function deleteStudent(studentNumber: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_student", { p_student_number: studentNumber });
  if (error) throw error;
}

// Bulk variant of deleteStudent — no reassignment needed (unlike teachers),
// since deleting a student just removes their roster row. Atomic via the
// delete_many_students RPC.
export async function deleteManyStudents(studentNumbers: string[]) {
  if (studentNumbers.length === 0) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_many_students", { p_student_numbers: studentNumbers });
  if (error) throw error;
  return data as number;
}

export async function studentRosterExists() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_roster").select("student_number").limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
