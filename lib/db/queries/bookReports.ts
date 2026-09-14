import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { bookReports } from "../schema";

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
