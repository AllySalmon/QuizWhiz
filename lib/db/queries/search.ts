import "server-only";
import { listStudents } from "./studentRoster";
import { createClient } from "@/lib/supabase/server";

const RESULT_LIMIT = 10;

// Global search, scoped to exactly three things (students, teachers,
// quiz/book) — deliberately not batches or Pilot data, which is isolated
// from real grading/roster by design elsewhere in the app.
//
// All three functions in this file go through the Supabase client, not
// Drizzle — RLS has no effect on the Drizzle connection (rolbypassrls=true),
// so a plain Drizzle select against any of these tables would be a direct
// cross-tenant leak on this file's own /search page. searchStudents()'s
// rostered half comes from studentRoster.ts's listStudents(), already
// RLS-scoped as of phase 3; searchTeachers() previously queried Drizzle
// directly and was the same class of leak as searchAnswerKeys() had,
// caught during phase 3's implementation rather than its plan review.

// Unions rostered students (via the existing listStudents search, which
// already ilike-matches student_number) with distinct student numbers that
// only exist in test_records — a historical/unrostered number should still
// be findable, since /students/[studentNumber] works for those too.
export async function searchStudents(q: string) {
  const rostered = await listStudents(q);
  const rosteredNumbers = new Set(rostered.map((s) => s.studentNumber));

  const supabase = await createClient();
  // No DISTINCT in a PostgREST select — dedupe in JS instead, over a wider
  // raw fetch than RESULT_LIMIT so a student with several tests doesn't
  // crowd out other distinct matches before dedup runs.
  const { data, error } = await supabase
    .from("test_records")
    .select("studentNumber:student_number")
    .not("student_number", "is", null)
    .ilike("student_number", `%${q}%`)
    .order("student_number", { ascending: true })
    .limit(50)
    .returns<{ studentNumber: string }[]>();
  if (error) throw error;

  const unrostered = [...new Set((data ?? []).map((r) => r.studentNumber))].filter((n) => !rosteredNumbers.has(n));

  return [
    ...rostered.slice(0, RESULT_LIMIT).map((s) => ({
      studentNumber: s.studentNumber,
      teacherName: s.teacherFirstName ? `${s.teacherFirstName} ${s.teacherLastName}` : null,
    })),
    ...unrostered.map((studentNumber) => ({ studentNumber, teacherName: null as string | null })),
  ].slice(0, RESULT_LIMIT);
}

// Two separate ilike queries merged/deduped in JS rather than one
// Drizzle-style `or(ilike, ilike)`, sidestepping PostgREST's `.or()`
// filter-string syntax (which needs manual escaping for commas/parens in
// the search text — not worth the risk for a 10-row search result). Same
// pattern as searchAnswerKeys() below.
export async function searchTeachers(q: string) {
  const supabase = await createClient();
  const columns = "id, firstName:first_name, lastName:last_name";
  type Row = { id: string; firstName: string; lastName: string };

  const [byFirst, byLast] = await Promise.all([
    supabase.from("teachers").select(columns).eq("is_active", true).ilike("first_name", `%${q}%`).limit(RESULT_LIMIT).returns<Row[]>(),
    supabase.from("teachers").select(columns).eq("is_active", true).ilike("last_name", `%${q}%`).limit(RESULT_LIMIT).returns<Row[]>(),
  ]);
  if (byFirst.error) throw byFirst.error;
  if (byLast.error) throw byLast.error;

  const merged = new Map<string, Row>();
  for (const row of [...(byFirst.data ?? []), ...(byLast.data ?? [])]) merged.set(row.id, row);
  return [...merged.values()].sort((a, b) => a.lastName.localeCompare(b.lastName)).slice(0, RESULT_LIMIT);
}

export async function searchAnswerKeys(q: string) {
  const supabase = await createClient();
  const columns = "id, quizCode:quiz_code, bookTitle:book_title";
  type Row = { id: string; quizCode: string; bookTitle: string };

  const [byCode, byTitle] = await Promise.all([
    supabase.from("answer_keys").select(columns).ilike("quiz_code", `%${q}%`).limit(RESULT_LIMIT).returns<Row[]>(),
    supabase.from("answer_keys").select(columns).ilike("book_title", `%${q}%`).limit(RESULT_LIMIT).returns<Row[]>(),
  ]);
  if (byCode.error) throw byCode.error;
  if (byTitle.error) throw byTitle.error;

  const merged = new Map<string, Row>();
  for (const row of [...(byCode.data ?? []), ...(byTitle.data ?? [])]) merged.set(row.id, row);
  return [...merged.values()].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle)).slice(0, RESULT_LIMIT);
}
