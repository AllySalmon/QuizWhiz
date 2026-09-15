import "server-only";
import { eq, asc, sql } from "drizzle-orm";
import { getDb } from "../client";
import { bookReports, teachers, testRecords, answerKeys } from "../schema";

// Docs/1-PRD.md §5.7: "A failing score automatically creates an outstanding
// book-report record — no manual step needed." Called from the grading
// pipeline (and from the Grading Review correction path if a correction
// flips a test from passing to failing).
export async function createBookReport(input: {
  testRecordId: string;
  studentNumber: string;
  teacherId: string | null;
  dueDate: string; // YYYY-MM-DD
}) {
  const db = getDb();
  const [report] = await db.insert(bookReports).values(input).returning();
  return report;
}

// Called when a Grading Review correction flips a test from failing to
// passing — she no longer actually owes a report for it.
export async function deleteBookReportByTestRecordId(testRecordId: string) {
  const db = getDb();
  await db.delete(bookReports).where(eq(bookReports.testRecordId, testRecordId));
}

export async function getBookReportByTestRecordId(testRecordId: string) {
  const db = getDb();
  const [report] = await db.select().from(bookReports).where(eq(bookReports.testRecordId, testRecordId));
  return report ?? null;
}

export async function countOutstandingBookReports() {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookReports)
    .where(eq(bookReports.status, "outstanding"));
  return row?.count ?? 0;
}

// Mirrors testRecords.ts's UNRECOGNIZED_QUIZ_CODE_ESCALATED — same 14-day
// rule, same computed-on-read approach (Docs/5-Backend-Schema.md §2.7).
const BOOK_REPORT_ESCALATED = sql<boolean>`(
  ${bookReports.status} = 'outstanding' AND ${bookReports.dueDate} < now() - interval '14 days'
)`;

// Flat list, sorted by teacher (nulls — unassigned — last) then escalated
// first within that teacher, then oldest due date first. The page groups
// consecutive rows by teacher for display, same pattern as listStudents().
export async function listOutstandingGroupedByTeacher() {
  const db = getDb();
  return db
    .select({
      id: bookReports.id,
      testRecordId: bookReports.testRecordId,
      studentNumber: bookReports.studentNumber,
      teacherId: bookReports.teacherId,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
      dueDate: bookReports.dueDate,
      bookTitle: answerKeys.bookTitle,
      isEscalated: BOOK_REPORT_ESCALATED,
    })
    .from(bookReports)
    .leftJoin(teachers, eq(bookReports.teacherId, teachers.id))
    .leftJoin(testRecords, eq(bookReports.testRecordId, testRecords.id))
    .leftJoin(answerKeys, eq(testRecords.quizCode, answerKeys.quizCode))
    .where(eq(bookReports.status, "outstanding"))
    .orderBy(asc(teachers.lastName), sql`${BOOK_REPORT_ESCALATED} desc`, asc(bookReports.dueDate));
}

export async function countEscalatedBookReports() {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookReports)
    .where(BOOK_REPORT_ESCALATED);
  return row?.count ?? 0;
}

// "she marks that record Received in the app" (Docs/1-PRD.md §5.7) — plain
// confirm action, no extra dialog.
export async function markReceived(id: string) {
  const db = getDb();
  const [report] = await db
    .update(bookReports)
    .set({ status: "received", receivedAt: new Date() })
    .where(eq(bookReports.id, id))
    .returning();
  return report ?? null;
}
