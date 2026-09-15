import "server-only";
import { createClient } from "@/lib/supabase/server";

// Phase 2 of the RLS conversion — same reasoning as testRecords.ts/answerKeys.ts.
// createBookReport()/deleteBookReportByTestRecordId() are still used directly
// (the initial grading pipeline's failing-test insert now happens inside the
// create_graded_test_record RPC instead, but the Grading Review correction
// path's reconciliation happens inside sync_test_record_grading — neither of
// those calls this file's createBookReport anymore; it's kept for callers
// that don't need cross-table atomicity, like deleteTestRecord's cleanup).

type BookReportRow = {
  id: string;
  testRecordId: string;
  studentNumber: string;
  teacherId: string | null;
  dueDate: string;
  status: "outstanding" | "received";
  receivedAt: string | null;
  createdAt: string;
};

const REPORT_COLUMNS =
  "id, testRecordId:test_record_id, studentNumber:student_number, teacherId:teacher_id, dueDate:due_date, status, receivedAt:received_at, createdAt:created_at";

// Docs/1-PRD.md §5.7: "A failing score automatically creates an outstanding
// book-report record — no manual step needed." Not called from the grading
// pipeline anymore (see file header) — kept for any caller that creates a
// book report outside that atomic path.
export async function createBookReport(input: {
  testRecordId: string;
  studentNumber: string;
  teacherId: string | null;
  dueDate: string; // YYYY-MM-DD
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_reports")
    .insert({
      test_record_id: input.testRecordId,
      student_number: input.studentNumber,
      teacher_id: input.teacherId,
      due_date: input.dueDate,
    })
    .select(REPORT_COLUMNS)
    .single<BookReportRow>();
  if (error) throw error;
  return data;
}

// Called when a Grading Review correction flips a test from failing to
// passing — she no longer actually owes a report for it.
export async function deleteBookReportByTestRecordId(testRecordId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("book_reports").delete().eq("test_record_id", testRecordId);
  if (error) throw error;
}

export async function getBookReportByTestRecordId(testRecordId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_reports")
    .select(REPORT_COLUMNS)
    .eq("test_record_id", testRecordId)
    .maybeSingle<BookReportRow>();
  if (error) throw error;
  return data ?? null;
}

export async function countOutstandingBookReports() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("book_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "outstanding");
  if (error) throw error;
  return count ?? 0;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Mirrors testRecords.ts's isGradingReviewEscalated — same 14-day rule, same
// computed-on-read approach (Docs/5-Backend-Schema.md §2.7), now in JS since
// PostgREST can't express the boolean expression as part of a .select().
function isBookReportEscalated(row: { status: string; dueDate: string }) {
  return row.status === "outstanding" && Date.now() - new Date(row.dueDate).getTime() > FOURTEEN_DAYS_MS;
}

type OutstandingRow = {
  id: string;
  testRecordId: string;
  studentNumber: string;
  teacherId: string | null;
  dueDate: string;
  teachers: { firstName: string; lastName: string } | null;
};

// Flat list, sorted by teacher (nulls — unassigned — last) then escalated
// first within that teacher, then oldest due date first. The page groups
// consecutive rows by teacher for display, same pattern as listStudents().
// bookTitle comes from answer_keys via test_records.quiz_code, which isn't
// a real FK — merged in JS the same way testRecords.ts's attachBookTitles does.
export async function listOutstandingGroupedByTeacher() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_reports")
    .select(
      "id, testRecordId:test_record_id, studentNumber:student_number, teacherId:teacher_id, dueDate:due_date, teachers(firstName:first_name, lastName:last_name)"
    )
    .eq("status", "outstanding")
    .returns<OutstandingRow[]>();
  if (error) throw error;
  const rows = data ?? [];

  const testRecordIds = [...new Set(rows.map((r) => r.testRecordId))];
  const quizCodeByTestRecordId = new Map<string, string | null>();
  if (testRecordIds.length > 0) {
    const { data: records, error: recError } = await supabase
      .from("test_records")
      .select("id, quizCode:quiz_code")
      .in("id", testRecordIds)
      .returns<{ id: string; quizCode: string | null }[]>();
    if (recError) throw recError;
    for (const r of records ?? []) quizCodeByTestRecordId.set(r.id, r.quizCode);
  }

  const codes = [...new Set([...quizCodeByTestRecordId.values()].filter((c): c is string => c !== null))];
  const bookTitleByCode = new Map<string, string>();
  if (codes.length > 0) {
    const { data: keys, error: keyError } = await supabase
      .from("answer_keys")
      .select("quizCode:quiz_code, bookTitle:book_title")
      .in("quiz_code", codes)
      .returns<{ quizCode: string; bookTitle: string }[]>();
    if (keyError) throw keyError;
    for (const k of keys ?? []) bookTitleByCode.set(k.quizCode, k.bookTitle);
  }

  const decorated = rows.map((r) => {
    const quizCode = quizCodeByTestRecordId.get(r.testRecordId) ?? null;
    return {
      id: r.id,
      testRecordId: r.testRecordId,
      studentNumber: r.studentNumber,
      teacherId: r.teacherId,
      teacherFirstName: r.teachers?.firstName ?? null,
      teacherLastName: r.teachers?.lastName ?? null,
      dueDate: r.dueDate,
      bookTitle: quizCode ? (bookTitleByCode.get(quizCode) ?? null) : null,
      isEscalated: isBookReportEscalated({ status: "outstanding", dueDate: r.dueDate }),
    };
  });

  decorated.sort((a, b) => {
    const lastNameCompare = (a.teacherLastName ?? "￿").localeCompare(b.teacherLastName ?? "￿");
    if (lastNameCompare !== 0) return lastNameCompare;
    const escalatedCompare = Number(b.isEscalated) - Number(a.isEscalated);
    if (escalatedCompare !== 0) return escalatedCompare;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return decorated;
}

export async function countEscalatedBookReports() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_reports")
    .select("status, dueDate:due_date")
    .eq("status", "outstanding")
    .returns<{ status: "outstanding"; dueDate: string }[]>();
  if (error) throw error;
  return (data ?? []).filter(isBookReportEscalated).length;
}

// "she marks that record Received in the app" (Docs/1-PRD.md §5.7) — plain
// confirm action, no extra dialog.
export async function markReceived(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_reports")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", id)
    .select(REPORT_COLUMNS)
    .maybeSingle<BookReportRow>();
  if (error) throw error;
  return data ?? null;
}
