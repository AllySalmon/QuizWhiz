import "server-only";
import { eq, and, asc, sql, gte, inArray, ilike } from "drizzle-orm";
import { getDb } from "../client";
import { testRecords, answerKeys, teachers, bookReports } from "../schema";
import { deleteScanImage } from "@/lib/supabase/storage";
import { createBookReport, deleteBookReportByTestRecordId, getBookReportByTestRecordId } from "./bookReports";
import type { AnswerChoice } from "./answerKeys";

export type NewTestRecord = {
  batchId: string;
  scanOrder: number;
  quizCode: string | null;
  studentNumber: string | null;
  ocrTeacherLastName: string | null;
  resolvedTeacherId: string | null;
  answersJson: Record<string, string | null>;
  scorePercent: number | null;
  passed: boolean | null;
  gradingStatus: "clean" | "needs_grading_review";
  assignmentStatus: "clean" | "needs_assignment_review";
  flagReasons: string[];
  scanImageRef: string | null;
};

export async function createTestRecord(input: NewTestRecord) {
  const db = getDb();
  const [record] = await db
    .insert(testRecords)
    .values({ ...input, scorePercent: input.scorePercent?.toString() ?? null })
    .returning();
  return record;
}

export async function getTestRecord(id: string) {
  const db = getDb();
  const [record] = await db.select().from(testRecords).where(eq(testRecords.id, id));
  return record ?? null;
}

export async function getTestRecordsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = getDb();
  return db.select().from(testRecords).where(inArray(testRecords.id, ids)).orderBy(asc(testRecords.scanOrder));
}

const queueSelection = {
  id: testRecords.id,
  batchId: testRecords.batchId,
  scanOrder: testRecords.scanOrder,
  quizCode: testRecords.quizCode,
  bookTitle: answerKeys.bookTitle,
  studentNumber: testRecords.studentNumber,
  ocrTeacherLastName: testRecords.ocrTeacherLastName,
  resolvedTeacherFirstName: teachers.firstName,
  resolvedTeacherLastName: teachers.lastName,
  answersJson: testRecords.answersJson,
  scorePercent: testRecords.scorePercent,
  passed: testRecords.passed,
  gradingStatus: testRecords.gradingStatus,
  assignmentStatus: testRecords.assignmentStatus,
  flagReasons: testRecords.flagReasons,
  scanImageRef: testRecords.scanImageRef,
  createdAt: testRecords.createdAt,
};

// Every test in a batch, regardless of status — the "what actually
// happened to my scans" list. The review queues only ever show what's
// currently outstanding, so once everything's resolved they go empty and
// there's otherwise nowhere to see the results at all.
export async function listTestRecordsForBatch(batchId: string) {
  const db = getDb();
  return db
    .select(queueSelection)
    .from(testRecords)
    .leftJoin(answerKeys, eq(testRecords.quizCode, answerKeys.quizCode))
    .leftJoin(teachers, eq(testRecords.resolvedTeacherId, teachers.id))
    .where(eq(testRecords.batchId, batchId))
    .orderBy(asc(testRecords.scanOrder));
}

// A stuck "unrecognized quiz code" item is escalated after 14 days —
// mirrors the book_reports escalation rule (Docs/5-Backend-Schema.md §2.7),
// computed on read the same way, applied here per the user's request to
// surface urgency on stuck Grading Review items without a new queue.
const UNRECOGNIZED_QUIZ_CODE_ESCALATED = sql<boolean>`(
  ${testRecords.flagReasons} @> '["unrecognized_quiz_code"]'::jsonb
  AND ${testRecords.createdAt} < now() - interval '14 days'
)`;

export async function listGradingReviewQueue(batchId?: string) {
  const db = getDb();
  const where = batchId
    ? and(eq(testRecords.gradingStatus, "needs_grading_review"), eq(testRecords.batchId, batchId))
    : eq(testRecords.gradingStatus, "needs_grading_review");

  const rows = await db
    .select({ ...queueSelection, isEscalated: UNRECOGNIZED_QUIZ_CODE_ESCALATED })
    .from(testRecords)
    .leftJoin(answerKeys, eq(testRecords.quizCode, answerKeys.quizCode))
    .leftJoin(teachers, eq(testRecords.resolvedTeacherId, teachers.id))
    .where(where)
    .orderBy(asc(testRecords.batchId), asc(testRecords.scanOrder));

  // Escalated items surface first; otherwise preserve scan order.
  return rows.sort((a, b) => Number(b.isEscalated) - Number(a.isEscalated));
}

export async function countEscalatedGradingReview() {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testRecords)
    .where(and(eq(testRecords.gradingStatus, "needs_grading_review"), UNRECOGNIZED_QUIZ_CODE_ESCALATED));
  return row?.count ?? 0;
}

export async function listAssignmentReviewQueue(batchId?: string) {
  const db = getDb();
  const where = batchId
    ? and(eq(testRecords.assignmentStatus, "needs_assignment_review"), eq(testRecords.batchId, batchId))
    : eq(testRecords.assignmentStatus, "needs_assignment_review");

  return db
    .select(queueSelection)
    .from(testRecords)
    .leftJoin(answerKeys, eq(testRecords.quizCode, answerKeys.quizCode))
    .leftJoin(teachers, eq(testRecords.resolvedTeacherId, teachers.id))
    .where(where)
    .orderBy(asc(testRecords.batchId), asc(testRecords.scanOrder));
}

// Grading Review, case 1: quiz code didn't match any key. She corrects the
// code (or adds the missing key); we re-attempt the match and, if it now
// resolves, score against it — same shape as initial grading, just retried.
export async function correctQuizCode(
  id: string,
  newQuizCode: string,
  matchedQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[] | null
) {
  const db = getDb();
  const record = await getTestRecord(id);
  if (!record) throw new Error("Test record not found.");

  if (matchedQuestions === null) {
    // Still no match — leave it in the queue with the corrected code saved.
    const [updated] = await db
      .update(testRecords)
      .set({ quizCode: newQuizCode })
      .where(eq(testRecords.id, id))
      .returning();
    return updated;
  }

  return scoreAgainstKey(id, matchedQuestions, { quizCode: newQuizCode });
}

// Grading Review, case 2: quiz code already matched, some answers were
// unclear. She confirms/corrects them directly (matches what's actually
// circled on the scan) and the score recalculates live (App Flow §4.6).
export async function correctAnswers(
  id: string,
  correctedAnswers: { questionNumber: number; selected: AnswerChoice }[],
  matchedQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[]
) {
  return scoreAgainstKey(id, matchedQuestions, {
    answersOverride: correctedAnswers,
  });
}

async function scoreAgainstKey(
  id: string,
  matchedQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[],
  opts: {
    quizCode?: string;
    answersOverride?: { questionNumber: number; selected: AnswerChoice }[];
  }
) {
  const db = getDb();
  const record = await getTestRecord(id);
  if (!record) throw new Error("Test record not found.");

  const existingAnswers = (record.answersJson ?? {}) as Record<string, string | null>;
  const answers = opts.answersOverride
    ? Object.fromEntries(opts.answersOverride.map((a) => [String(a.questionNumber), a.selected]))
    : existingAnswers;

  let correctCount = 0;
  for (const q of matchedQuestions) {
    if (answers[String(q.questionNumber)] === q.correctAnswer) correctCount++;
  }
  const scorePercent = matchedQuestions.length > 0 ? (correctCount / matchedQuestions.length) * 100 : 0;
  const passed = scorePercent >= 80;

  // Grading is resolved; any grading-side flags clear. Assignment-side flags
  // (independent track) are left untouched.
  const remainingFlags = ((record.flagReasons ?? []) as string[]).filter(
    (f) => !f.startsWith("unclear_answer_q") && f !== "unrecognized_quiz_code"
  );

  const [updated] = await db
    .update(testRecords)
    .set({
      quizCode: opts.quizCode ?? record.quizCode,
      answersJson: answers,
      scorePercent: scorePercent.toString(),
      passed,
      gradingStatus: "resolved",
      flagReasons: remainingFlags,
      reviewedAt: new Date(),
    })
    .where(eq(testRecords.id, id))
    .returning();

  await syncBookReportOnScoreChange(updated);
  await maybeDeleteScanImage(id);
  return updated;
}

// A correction can flip pass/fail — the book report has to follow
// (Docs/1-PRD.md §5.7 ties it strictly to the current passed state).
async function syncBookReportOnScoreChange(record: typeof testRecords.$inferSelect) {
  const existing = await getBookReportByTestRecordId(record.id);
  if (record.passed === false && !existing) {
    await createBookReport({
      testRecordId: record.id,
      studentNumber: record.studentNumber ?? "",
      teacherId: record.resolvedTeacherId,
      dueDate: new Date().toISOString().slice(0, 10),
    });
  } else if (record.passed !== false && existing) {
    await deleteBookReportByTestRecordId(record.id);
  }
}

export async function correctAssignment(
  id: string,
  input: { studentNumber: string; teacherId: string }
) {
  const db = getDb();
  const [updated] = await db
    .update(testRecords)
    .set({
      studentNumber: input.studentNumber,
      resolvedTeacherId: input.teacherId,
      assignmentStatus: "resolved",
      reviewedAt: new Date(),
    })
    .where(eq(testRecords.id, id))
    .returning();

  // The book report (if any) follows the same resolution path (Docs/5-Backend-Schema.md §2.7).
  const report = await getBookReportByTestRecordId(id);
  if (report && !report.teacherId) {
    await db.update(bookReports).set({ teacherId: input.teacherId }).where(eq(bookReports.id, report.id));
  }

  await maybeDeleteScanImage(id);
  return updated;
}

// Docs/5-Backend-Schema.md §2.6 retention: delete the scan image once both
// statuses are resolved/clean. The 30-day fallback sweep is a separate
// scheduled job, not implemented here.
export async function maybeDeleteScanImage(id: string) {
  const record = await getTestRecord(id);
  if (!record || !record.scanImageRef) return;

  const gradingDone = record.gradingStatus === "clean" || record.gradingStatus === "resolved";
  const assignmentDone = record.assignmentStatus === "clean" || record.assignmentStatus === "resolved";
  if (!gradingDone || !assignmentDone) return;

  const db = getDb();
  await deleteScanImage(record.scanImageRef);
  await db.update(testRecords).set({ scanImageRef: null }).where(eq(testRecords.id, id));
}

// Deletes one scanned test entirely: its book report (if any), its scan
// image in storage (if not already cleared by retention), then the
// test_records row itself. Used for a single mis-scanned/duplicate entry;
// see deleteBatch in lib/db/queries/batches.ts for removing a whole batch.
export async function deleteTestRecord(id: string) {
  const record = await getTestRecord(id);
  if (!record) return;

  await deleteBookReportByTestRecordId(id);
  if (record.scanImageRef) {
    await deleteScanImage(record.scanImageRef).catch(() => {
      // Already gone (retention cleanup, or never uploaded) — fine to continue.
    });
  }

  const db = getDb();
  await db.delete(testRecords).where(eq(testRecords.id, id));
}

// Bulk variant — same per-record cleanup (book report, scan image) as
// deleteTestRecord, for a multi-select "Delete selected" action.
export async function deleteManyTestRecords(ids: string[]) {
  for (const id of ids) {
    await deleteTestRecord(id);
  }
}

// Every test graded since local midnight, across all batches — the Home
// dashboard's "Graded Today" card links here. Not batch-scoped, since a
// day can span multiple batches; read-only (no bulk delete — that stays
// scoped to a single batch's own page, per the plan).
export async function listGradedToday() {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return db
    .select(queueSelection)
    .from(testRecords)
    .leftJoin(answerKeys, eq(testRecords.quizCode, answerKeys.quizCode))
    .leftJoin(teachers, eq(testRecords.resolvedTeacherId, teachers.id))
    .where(gte(testRecords.createdAt, todayStart))
    .orderBy(sql`${testRecords.createdAt} desc`);
}

// Called after a new Answer Key is created (app/(app)/answer-keys/actions.ts)
// — makes "add the missing key and the test processes as normal" literally
// true, instead of requiring her to also manually re-correct each stuck
// test via the Grading Review screen. Reuses the exact scoring path
// correctQuizCode already uses for a manual correction.
export async function reconcileTestsForNewAnswerKey(
  quizCode: string,
  questions: { questionNumber: number; correctAnswer: AnswerChoice }[]
) {
  const db = getDb();
  const stuck = await db
    .select({ id: testRecords.id, quizCode: testRecords.quizCode })
    .from(testRecords)
    .where(
      and(
        ilike(testRecords.quizCode, quizCode.trim()),
        eq(testRecords.gradingStatus, "needs_grading_review"),
        sql`${testRecords.flagReasons} @> '["unrecognized_quiz_code"]'::jsonb`
      )
    );

  for (const record of stuck) {
    await correctQuizCode(record.id, record.quizCode!, questions);
  }

  return stuck.length;
}

export async function countsForBatch(batchId: string) {
  const db = getDb();
  const rows = await db
    .select({ gradingStatus: testRecords.gradingStatus, assignmentStatus: testRecords.assignmentStatus })
    .from(testRecords)
    .where(eq(testRecords.batchId, batchId));

  return {
    total: rows.length,
    clean: rows.filter((r) => r.gradingStatus !== "needs_grading_review" && r.assignmentStatus !== "needs_assignment_review").length,
    gradingReview: rows.filter((r) => r.gradingStatus === "needs_grading_review").length,
    assignmentReview: rows.filter((r) => r.assignmentStatus === "needs_assignment_review").length,
  };
}

export async function dashboardCounts() {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [gradedToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testRecords)
    .where(gte(testRecords.createdAt, todayStart));

  const [gradingReview] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testRecords)
    .where(eq(testRecords.gradingStatus, "needs_grading_review"));

  const [assignmentReview] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testRecords)
    .where(eq(testRecords.assignmentStatus, "needs_assignment_review"));

  return {
    gradedToday: gradedToday?.count ?? 0,
    gradingReview: gradingReview?.count ?? 0,
    assignmentReview: assignmentReview?.count ?? 0,
  };
}
