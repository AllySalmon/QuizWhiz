import "server-only";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "../client";
import { teachers } from "../schema";
import { listStudents } from "./studentRoster";
import { createClient } from "@/lib/supabase/server";

const RESULT_LIMIT = 10;

// Global search, scoped to exactly three things (students, teachers,
// quiz/book) — deliberately not batches or Pilot data, which is isolated
// from real grading/roster by design elsewhere in the app.

// Unions rostered students (via the existing listStudents search, which
// already ilike-matches student_number) with distinct student numbers that
// only exist in test_records — a historical/unrostered number should still
// be findable, since /students/[studentNumber] works for those too.
//
// The test_records half goes through the Supabase client, not Drizzle —
// same reason as searchAnswerKeys()'s rewrite in this file: RLS has no
// effect on the Drizzle connection, so a plain Drizzle select here would be
// an immediate cross-tenant leak once test_records has RLS (found during
// review of the test_records/book_reports conversion plan — this function
// wasn't in that pass's original scope, but is the same bug in the same
// shape). student_roster isn't tenant-scoped yet, so listStudents()'s half
// stays on Drizzle unchanged for now.
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

export async function searchTeachers(q: string) {
  const db = getDb();
  return db
    .select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName })
    .from(teachers)
    .where(
      and(
        eq(teachers.isActive, true),
        or(ilike(teachers.firstName, `%${q}%`), ilike(teachers.lastName, `%${q}%`))
      )
    )
    .orderBy(asc(teachers.lastName))
    .limit(RESULT_LIMIT);
}

// Goes through the Supabase client, not Drizzle, unlike its two siblings
// above — a plain Drizzle select here would be an immediate cross-tenant
// leak (RLS has no effect on the Drizzle connection; see the approved
// plan). Two separate ilike queries merged/deduped in JS rather than one
// Drizzle-style `or(ilike, ilike)`, sidestepping PostgREST's `.or()`
// filter-string syntax (which needs manual escaping for commas/parens in
// the search text — not worth the risk for a 10-row search result).
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
