import "server-only";
import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { getDb } from "../client";
import { testRecords, teachers } from "../schema";
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
export async function searchStudents(q: string) {
  const db = getDb();
  const rostered = await listStudents(q);
  const rosteredNumbers = new Set(rostered.map((s) => s.studentNumber));

  const unrosteredRows = await db
    .selectDistinct({ studentNumber: testRecords.studentNumber })
    .from(testRecords)
    .where(and(isNotNull(testRecords.studentNumber), ilike(testRecords.studentNumber, `%${q}%`)))
    .limit(RESULT_LIMIT);

  const unrostered = unrosteredRows
    .map((r) => r.studentNumber!)
    .filter((n) => !rosteredNumbers.has(n));

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
