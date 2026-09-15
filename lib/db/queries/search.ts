import "server-only";
import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { getDb } from "../client";
import { testRecords, teachers, answerKeys } from "../schema";
import { listStudents } from "./studentRoster";

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

export async function searchAnswerKeys(q: string) {
  const db = getDb();
  return db
    .select({ id: answerKeys.id, quizCode: answerKeys.quizCode, bookTitle: answerKeys.bookTitle })
    .from(answerKeys)
    .where(or(ilike(answerKeys.quizCode, `%${q}%`), ilike(answerKeys.bookTitle, `%${q}%`)))
    .orderBy(asc(answerKeys.bookTitle))
    .limit(RESULT_LIMIT);
}
