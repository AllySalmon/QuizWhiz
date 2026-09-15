import "server-only";
import { createClient } from "@/lib/supabase/server";
import { deleteScanImage, getSignedScanImageUrl } from "@/lib/supabase/storage";
import { deleteBookReportByTestRecordId } from "./bookReports";
import type { AnswerChoice } from "./answerKeys";

// Phase 2 of the RLS conversion (see the approved plan): this file queries
// through the Supabase client (PostgREST), not Drizzle — same reasoning as
// answerKeys.ts (rolbypassrls=true on the Drizzle connection). The three
// multi-table writes below (create, grading correction, assignment
// correction) call Postgres RPCs (supabase/test-records-functions.sql)
// instead of db.transaction()/sequential inserts, since supabase-js has no
// multi-statement transaction primitive and an orphaned test_records/
// book_reports pair is a silent, not-harmless failure (unlike the
// answer_keys PoC's orphaned-key tradeoff).
//
// createdAt/reviewedAt come back as ISO strings, not Date objects (see
// answerKeys.ts for the same note) — typed as `string` below.
//
// teachers(...) below is a real embedded-resource join (resolved_teacher_id
// references teachers.id) — PostgREST can express that directly. quiz_code
// -> answer_keys.quiz_code is deliberately NOT a foreign key (a code can
// legitimately match no key), so it can't be embedded the same way; book
// titles are attached via a second query + JS merge (attachBookTitles),
// same "merge in JS instead of fighting PostgREST's query surface" call
// already made for searchAnswerKeys(). The POSSIBLE_DUPLICATE/escalation
// flags that used to be computed-on-read SQL are JS-computed the same way —
// see attachDuplicateFlag and isEscalated below.

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

type TestRecordRow = {
  id: string;
  batchId: string;
  scanOrder: number;
  quizCode: string | null;
  studentNumber: string | null;
  ocrTeacherLastName: string | null;
  resolvedTeacherId: string | null;
  answersJson: Record<string, string | null>;
  scorePercent: string | null;
  passed: boolean | null;
  gradingStatus: "clean" | "needs_grading_review" | "resolved";
  assignmentStatus: "clean" | "needs_assignment_review" | "resolved";
  flagReasons: string[];
  scanImageRef: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const RECORD_COLUMNS =
  "id, batchId:batch_id, scanOrder:scan_order, quizCode:quiz_code, studentNumber:student_number, ocrTeacherLastName:ocr_teacher_last_name, resolvedTeacherId:resolved_teacher_id, answersJson:answers_json, scorePercent:score_percent, passed, gradingStatus:grading_status, assignmentStatus:assignment_status, flagReasons:flag_reasons, scanImageRef:scan_image_ref, reviewedAt:reviewed_at, createdAt:created_at";

type Teacher = { firstName: string; lastName: string } | null;
type RawQueueRow = TestRecordRow & { teachers: Teacher };
const QUEUE_COLUMNS = `${RECORD_COLUMNS}, teachers(firstName:first_name, lastName:last_name)`;

// Flattens the teachers(...) embed into the flat resolvedTeacherFirstName/
// resolvedTeacherLastName fields the old Drizzle queueSelection returned —
// every consumer of these queue-shaped rows expects those flat fields, not
// a nested object.
function flattenTeacher(row: RawQueueRow) {
  const { teachers, ...rest } = row;
  return { ...rest, resolvedTeacherFirstName: teachers?.firstName ?? null, resolvedTeacherLastName: teachers?.lastName ?? null };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Attaches bookTitle from answer_keys, matched by quiz_code (not a real FK —
// see file header). A plain .in() query, not a correlated one, so this is
// safe to batch across however many distinct codes the caller's rows have.
async function attachBookTitles<T extends { quizCode: string | null }>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<(T & { bookTitle: string | null })[]> {
  const codes = [...new Set(rows.map((r) => r.quizCode).filter((c): c is string => c !== null))];
  if (codes.length === 0) return rows.map((r) => ({ ...r, bookTitle: null }));

  const { data, error } = await supabase
    .from("answer_keys")
    .select("quizCode:quiz_code, bookTitle:book_title")
    .in("quiz_code", codes)
    .returns<{ quizCode: string; bookTitle: string }[]>();
  if (error) throw error;

  const titleByCode = new Map((data ?? []).map((k) => [k.quizCode, k.bookTitle]));
  return rows.map((r) => ({ ...r, bookTitle: r.quizCode ? (titleByCode.get(r.quizCode) ?? null) : null }));
}

// Attaches isDuplicate: another of the caller's own test_records shares the
// same (studentNumber, quizCode). Needs visibility across the caller's
// whole table (RLS-scoped to them already), not just whatever this query's
// own filter narrowed to — e.g. listGradingReviewQueue's flag has to know
// about a match sitting in a different status. PostgREST can't express the
// correlated self-join EXISTS the old Drizzle version used, so this fetches
// the (studentNumber, quizCode) pairs once and counts in JS instead.
async function attachDuplicateFlag<
  T extends { id: string; studentNumber: string | null; quizCode: string | null },
>(supabase: SupabaseClient, rows: T[]): Promise<(T & { isDuplicate: boolean })[]> {
  const { data, error } = await supabase
    .from("test_records")
    .select("studentNumber:student_number, quizCode:quiz_code")
    .not("student_number", "is", null)
    .not("quiz_code", "is", null)
    .returns<{ studentNumber: string; quizCode: string }[]>();
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const key = `${r.studentNumber}|${r.quizCode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r,
    isDuplicate:
      r.studentNumber !== null && r.quizCode !== null && (counts.get(`${r.studentNumber}|${r.quizCode}`) ?? 0) > 1,
  }));
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Mirrors UNRECOGNIZED_QUIZ_CODE_ESCALATED's 14-day rule (Docs/5-Backend-Schema.md §2.7).
function isGradingReviewEscalated(row: { flagReasons: string[]; createdAt: string }) {
  return row.flagReasons.includes("unrecognized_quiz_code") && Date.now() - new Date(row.createdAt).getTime() > FOURTEEN_DAYS_MS;
}

// Atomic via the create_graded_test_record RPC (supabase/test-records-functions.sql):
// inserts the test record and, if it failed, its book report, in one
// Postgres transaction. Used only by the real grading pipeline
// (app/api/grading/process-image/route.ts), which used to do these as two
// separate Drizzle calls with no transaction and no cleanup on failure —
// this closes that gap, not just preserves it.
export async function createTestRecord(input: NewTestRecord) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_graded_test_record", {
      p_batch_id: input.batchId,
      p_scan_order: input.scanOrder,
      p_quiz_code: input.quizCode,
      p_student_number: input.studentNumber,
      p_ocr_teacher_last_name: input.ocrTeacherLastName,
      p_resolved_teacher_id: input.resolvedTeacherId,
      p_answers_json: input.answersJson,
      p_score_percent: input.scorePercent,
      p_passed: input.passed,
      p_grading_status: input.gradingStatus,
      p_assignment_status: input.assignmentStatus,
      p_flag_reasons: input.flagReasons,
      p_scan_image_ref: input.scanImageRef,
    })
    .single<TestRecordRow>();
  if (error) throw error;
  return data;
}

// Every test in a batch, regardless of status — the "what actually
// happened to my scans" list. The review queues only ever show what's
// currently outstanding, so once everything's resolved they go empty and
// there's otherwise nowhere to see the results at all.
export async function listTestRecordsForBatch(batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(QUEUE_COLUMNS)
    .eq("batch_id", batchId)
    .order("scan_order", { ascending: true })
    .returns<RawQueueRow[]>();
  if (error) throw error;

  const rows = (data ?? []).map(flattenTeacher);
  return attachDuplicateFlag(supabase, await attachBookTitles(supabase, rows));
}

export async function getTestRecord(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(RECORD_COLUMNS)
    .eq("id", id)
    .maybeSingle<TestRecordRow>();
  if (error) throw error;
  return data ?? null;
}

// The storage isolation fix: lib/supabase/storage.ts's getSignedScanImageUrl
// takes a raw path and has no ownership check of its own (it has to use the
// admin client — the bucket has no policies granting the browser client any
// access at all). Routing every real call through getTestRecord() first
// makes the check structural — RLS means getTestRecord() returns null for a
// scan the caller doesn't own, so no signed URL is ever generated for it —
// rather than relying on every call site to remember to check. Pilot
// tooling's own scan images (comparison_run_items) intentionally bypass
// this — that table isn't part of the tenant model at all (see schema.ts).
export async function getTestRecordScanImageUrl(id: string) {
  const record = await getTestRecord(id);
  if (!record?.scanImageRef) return null;
  return getSignedScanImageUrl(record.scanImageRef);
}

export async function getTestRecordsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(RECORD_COLUMNS)
    .in("id", ids)
    .order("scan_order", { ascending: true })
    .returns<TestRecordRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listGradingReviewQueue(batchId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("test_records")
    .select(QUEUE_COLUMNS)
    .eq("grading_status", "needs_grading_review")
    .order("batch_id", { ascending: true })
    .order("scan_order", { ascending: true });
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query.returns<RawQueueRow[]>();
  if (error) throw error;

  const flattened = (data ?? []).map(flattenTeacher);
  const withTitles = await attachBookTitles(supabase, flattened);
  const withDuplicates = await attachDuplicateFlag(supabase, withTitles);
  const rows = withDuplicates.map((r) => ({ ...r, isEscalated: isGradingReviewEscalated(r) }));

  // Escalated items surface first; otherwise preserve scan order.
  return rows.sort((a, b) => Number(b.isEscalated) - Number(a.isEscalated));
}

export async function countEscalatedGradingReview() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select("flagReasons:flag_reasons, createdAt:created_at")
    .eq("grading_status", "needs_grading_review")
    .returns<{ flagReasons: string[]; createdAt: string }[]>();
  if (error) throw error;
  return (data ?? []).filter(isGradingReviewEscalated).length;
}

export async function listAssignmentReviewQueue(batchId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("test_records")
    .select(QUEUE_COLUMNS)
    .eq("assignment_status", "needs_assignment_review")
    .order("batch_id", { ascending: true })
    .order("scan_order", { ascending: true });
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query.returns<RawQueueRow[]>();
  if (error) throw error;

  const rows = (data ?? []).map(flattenTeacher);
  return attachDuplicateFlag(supabase, await attachBookTitles(supabase, rows));
}

// Grading Review, case 1: quiz code didn't match any key. She corrects the
// code (or adds the missing key); we re-attempt the match and, if it now
// resolves, score against it — same shape as initial grading, just retried.
export async function correctQuizCode(
  id: string,
  newQuizCode: string,
  matchedQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[] | null
) {
  if (matchedQuestions === null) {
    // Still no match — leave it in the queue with the corrected code saved.
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("test_records")
      .update({ quiz_code: newQuizCode })
      .eq("id", id)
      .select(RECORD_COLUMNS)
      .single<TestRecordRow>();
    if (error) throw error;
    return data;
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

// Atomic via the sync_test_record_grading RPC (supabase/test-records-functions.sql):
// updates the test record and reconciles its book report (create/delete) in
// one Postgres transaction, instead of the two separate calls this used to
// be — a scored failing test silently missing its book report is exactly
// the "not acceptable" failure class flagged when this table's conversion
// was planned.
async function scoreAgainstKey(
  id: string,
  matchedQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[],
  opts: {
    quizCode?: string;
    answersOverride?: { questionNumber: number; selected: AnswerChoice }[];
  }
) {
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("sync_test_record_grading", {
      p_id: id,
      p_quiz_code: opts.quizCode ?? record.quizCode,
      p_answers_json: answers,
      p_score_percent: scorePercent,
      p_passed: passed,
      p_grading_status: "resolved",
      p_flag_reasons: remainingFlags,
    })
    .single<TestRecordRow>();
  if (error) throw error;

  await maybeDeleteScanImage(id);
  return data;
}

// Also reachable after assignmentStatus is already "resolved" — a genuine
// correction, not just the first-time resolution (review/assignment/[id]/page.tsx
// no longer gates the form on status). Atomic via the
// correct_test_record_assignment RPC: update + audit_log insert + book-report
// teacher sync all happen in one Postgres transaction now (the teacher sync
// used to run as a separate, non-atomic call after the rest).
export async function correctAssignment(id: string, input: { studentNumber: string; teacherId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("correct_test_record_assignment", {
      p_id: id,
      p_student_number: input.studentNumber,
      p_teacher_id: input.teacherId,
    })
    .single<TestRecordRow>();
  if (error) throw error;

  await maybeDeleteScanImage(id);
  return data;
}

// Docs/5-Backend-Schema.md §2.6 retention: delete the scan image once both
// statuses are resolved/clean. The time-based fallback sweep described in
// that doc doesn't exist yet as a scheduled job anywhere in this codebase —
// this event-driven half is the only retention mechanism that runs today.
export async function maybeDeleteScanImage(id: string) {
  const record = await getTestRecord(id);
  if (!record || !record.scanImageRef) return;

  const gradingDone = record.gradingStatus === "clean" || record.gradingStatus === "resolved";
  const assignmentDone = record.assignmentStatus === "clean" || record.assignmentStatus === "resolved";
  if (!gradingDone || !assignmentDone) return;

  await deleteScanImage(record.scanImageRef);

  const supabase = await createClient();
  const { error } = await supabase.from("test_records").update({ scan_image_ref: null }).eq("id", id);
  if (error) throw error;
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

  const supabase = await createClient();
  const { error } = await supabase.from("test_records").delete().eq("id", id);
  if (error) throw error;
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
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("test_records")
    .select(QUEUE_COLUMNS)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })
    .returns<RawQueueRow[]>();
  if (error) throw error;

  const rows = (data ?? []).map(flattenTeacher);
  return attachDuplicateFlag(supabase, await attachBookTitles(supabase, rows));
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
  const supabase = await createClient();
  const { data: stuck, error } = await supabase
    .from("test_records")
    .select("id, quizCode:quiz_code")
    .ilike("quiz_code", quizCode.trim())
    .eq("grading_status", "needs_grading_review")
    .contains("flag_reasons", ["unrecognized_quiz_code"])
    .returns<{ id: string; quizCode: string }[]>();
  if (error) throw error;

  for (const record of stuck ?? []) {
    await correctQuizCode(record.id, record.quizCode, questions);
  }

  return (stuck ?? []).length;
}

export async function countsForBatch(batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select("gradingStatus:grading_status, assignmentStatus:assignment_status")
    .eq("batch_id", batchId)
    .returns<{ gradingStatus: string; assignmentStatus: string }[]>();
  if (error) throw error;

  const rows = data ?? [];
  return {
    total: rows.length,
    clean: rows.filter((r) => r.gradingStatus !== "needs_grading_review" && r.assignmentStatus !== "needs_assignment_review").length,
    gradingReview: rows.filter((r) => r.gradingStatus === "needs_grading_review").length,
    assignmentReview: rows.filter((r) => r.assignmentStatus === "needs_assignment_review").length,
  };
}

export async function dashboardCounts() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [gradedToday, gradingReview, assignmentReview] = await Promise.all([
    supabase.from("test_records").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    supabase.from("test_records").select("*", { count: "exact", head: true }).eq("grading_status", "needs_grading_review"),
    supabase.from("test_records").select("*", { count: "exact", head: true }).eq("assignment_status", "needs_assignment_review"),
  ]);
  if (gradedToday.error) throw gradedToday.error;
  if (gradingReview.error) throw gradingReview.error;
  if (assignmentReview.error) throw assignmentReview.error;

  return {
    gradedToday: gradedToday.count ?? 0,
    gradingReview: gradingReview.count ?? 0,
    assignmentReview: assignmentReview.count ?? 0,
  };
}

export type TeacherReportRow = {
  id: string;
  scanOrder: number;
  studentNumber: string | null;
  bookTitle: string | null;
  quizCode: string | null;
  scorePercent: string | null;
  passed: boolean | null;
  createdAt: string;
};

export type TeacherReportGroup = {
  teacherId: string;
  teacherFirstName: string;
  teacherLastName: string;
  rows: TeacherReportRow[];
};

// Docs/1-PRD.md §5.6: a report only ever contains fully-resolved tests — a
// test still sitting in either review queue is excluded (the page links
// back to resolve it, rather than the report guessing), grouped by the
// roster-resolved teacher (not the handwriting on the sheet), sorted by
// scan order within each group. teachers!inner mirrors the original
// innerJoin — a row with no resolved teacher is excluded entirely, not
// grouped under null.
export async function getTeacherGroupedReport(batchId: string): Promise<TeacherReportGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(
      "id, scanOrder:scan_order, studentNumber:student_number, quizCode:quiz_code, scorePercent:score_percent, passed, createdAt:created_at, teachers!inner(id, firstName:first_name, lastName:last_name)"
    )
    .eq("batch_id", batchId)
    .neq("grading_status", "needs_grading_review")
    .neq("assignment_status", "needs_assignment_review")
    .returns<
      {
        id: string;
        scanOrder: number;
        studentNumber: string | null;
        quizCode: string | null;
        scorePercent: string | null;
        passed: boolean | null;
        createdAt: string;
        teachers: { id: string; firstName: string; lastName: string };
      }[]
    >();
  if (error) throw error;

  const withTitles = await attachBookTitles(supabase, data ?? []);
  withTitles.sort((a, b) => a.teachers.lastName.localeCompare(b.teachers.lastName) || a.scanOrder - b.scanOrder);

  const groups = new Map<string, TeacherReportGroup>();
  for (const row of withTitles) {
    if (!groups.has(row.teachers.id)) {
      groups.set(row.teachers.id, {
        teacherId: row.teachers.id,
        teacherFirstName: row.teachers.firstName,
        teacherLastName: row.teachers.lastName,
        rows: [],
      });
    }
    groups.get(row.teachers.id)!.rows.push({
      id: row.id,
      scanOrder: row.scanOrder,
      studentNumber: row.studentNumber,
      bookTitle: row.bookTitle,
      quizCode: row.quizCode,
      scorePercent: row.scorePercent,
      passed: row.passed,
      createdAt: row.createdAt,
    });
  }
  return [...groups.values()];
}

// Global, cross-batch visibility for the duplicate flag — deliberately not
// a new review queue (that would blur "blocking, needs resolution" against
// "advisory, still clean and reportable"). Sorted so records sharing the
// same student + quiz code land next to each other, oldest first within
// that group, for the page to visually group.
export async function listPossibleDuplicates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(QUEUE_COLUMNS)
    .not("student_number", "is", null)
    .not("quiz_code", "is", null)
    .returns<RawQueueRow[]>();
  if (error) throw error;

  const flattened = (data ?? []).map(flattenTeacher);
  const withTitles = await attachBookTitles(supabase, flattened);
  const withDuplicates = await attachDuplicateFlag(supabase, withTitles);

  return withDuplicates
    .filter((r) => r.isDuplicate)
    .sort(
      (a, b) =>
        (a.studentNumber ?? "").localeCompare(b.studentNumber ?? "") ||
        (a.quizCode ?? "").localeCompare(b.quizCode ?? "") ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export async function countPossibleDuplicates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select("studentNumber:student_number, quizCode:quiz_code")
    .not("student_number", "is", null)
    .not("quiz_code", "is", null)
    .returns<{ studentNumber: string; quizCode: string }[]>();
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const key = `${r.studentNumber}|${r.quizCode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((n) => n > 1).reduce((sum, n) => sum + n, 0);
}

// The student history page's data — every test this student number has
// ever had, regardless of status (same "what actually happened" philosophy
// as listTestRecordsForBatch, not the Reports screen's exclude-and-link-back
// one — a test stuck in review still belongs here). Includes a scored but
// not-yet-assigned test with its real score, since grading and assignment
// are independent tracks (Docs/5-Backend-Schema.md §1). book_reports is
// embedded as a reverse relationship (its FK points at test_records, not
// the other way around), so it comes back as an array — this app's
// invariant is at most one per test record, so [0] is taken directly.
export async function getStudentTestHistory(studentNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_records")
    .select(`${QUEUE_COLUMNS}, book_reports(status)`)
    .eq("student_number", studentNumber)
    .order("created_at", { ascending: false })
    .returns<(RawQueueRow & { book_reports: { status: string }[] })[]>();
  if (error) throw error;

  const flattened = (data ?? []).map((row) => ({ ...flattenTeacher(row), book_reports: row.book_reports }));
  const withTitles = await attachBookTitles(supabase, flattened);
  const withDuplicates = await attachDuplicateFlag(supabase, withTitles);

  return withDuplicates.map((r) => ({
    ...r,
    bookReportStatus: r.book_reports?.[0]?.status ?? null,
  }));
}
