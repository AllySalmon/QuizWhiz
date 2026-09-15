// Mirrors Docs/5-Backend-Schema.md. Keep that doc and this file in sync —
// the doc is the source of truth for *why*, this file is the source of truth for *shape*.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const gradeBandEnum = pgEnum("grade_band", ["jr", "3-5"]);
export const answerEnum = pgEnum("answer_choice", ["A", "B", "C", "D"]);
export const sourceTypeEnum = pgEnum("source_type", ["photo", "pdf"]);
export const gradingStatusEnum = pgEnum("grading_status", [
  "clean",
  "needs_grading_review",
  "resolved",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "clean",
  "needs_assignment_review",
  "resolved",
]);
export const bookReportStatusEnum = pgEnum("book_report_status", [
  "outstanding",
  "received",
]);

// 2.1 teachers — real records (staff, not the children this app protects)
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(), // matched against handwritten OCR text
  isActive: boolean("is_active").notNull().default(true), // soft-delete flag
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`), // bumped on rename
});

// 2.2 student_roster — Student -> Teacher assignment (never a student name)
export const studentRoster = pgTable("student_roster", {
  studentNumber: text("student_number").primaryKey(),
  teacherId: uuid("teacher_id").references(() => teachers.id), // null only transiently during reassignment
  gradeBand: gradeBandEnum("grade_band").notNull(), // informational only — never cross-checked at grading time
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});
// CSV import behavior (app-layer, not DB-enforced): upsert by student_number.
// Existing rows update teacher_id/grade_band; new numbers insert; import never deletes.
// Malformed/unknown-teacher rows are skipped and summarized for the librarian, not fatal to the batch.

// 2.3 answer_keys
// user_id: added nullable here on purpose — Drizzle doesn't model the
// auth.users FK, the NOT NULL constraint, the auth.uid() default, or RLS
// (all applied by hand in supabase/answer-keys-rls.sql, same precedent as
// storage-setup.sql) so drizzle-kit never has to reason about the auth
// schema. Backfilled to the real dev account before the NOT NULL lands.
export const answerKeys = pgTable("answer_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id"),
  quizCode: text("quiz_code").notNull().unique(), // printed on the physical sheet — stays globally unique for now, see supabase/answer-keys-rls.sql
  bookTitle: text("book_title").notNull(),
  gradeBand: gradeBandEnum("grade_band").notNull(),
  questionCount: integer("question_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// 2.4 answer_key_questions
export const answerKeyQuestions = pgTable(
  "answer_key_questions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    answerKeyId: uuid("answer_key_id")
      .notNull()
      .references(() => answerKeys.id),
    userId: uuid("user_id"), // same treatment as answerKeys.userId above
    questionNumber: integer("question_number").notNull(),
    correctAnswer: answerEnum("correct_answer").notNull(),
  },
  (table) => [
    uniqueIndex("answer_key_questions_key_question_unique").on(
      table.answerKeyId,
      table.questionNumber
    ),
  ]
);

// 2.5 batches — one row per upload session, not a fixed weekly cycle
// user_id: same treatment as answerKeys.userId above — added nullable here on
// purpose, NOT NULL/FK/default/RLS applied by hand in supabase/test-records-rls.sql.
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id"),
  label: text("label").notNull(), // auto-generated, e.g. "Tue 9/16, 10:04am"
  sourceType: sourceTypeEnum("source_type").notNull(),
  itemCount: integer("item_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// 2.6 test_records — the core grading table, one row per scanned test
// user_id: same treatment as answerKeys.userId above.
export const testRecords = pgTable(
  "test_records",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id"),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id),
    scanOrder: integer("scan_order").notNull(), // drives report sort order within a teacher's group

    // Deliberately NOT a hard FK: a quiz code can be read but match no answer_keys row
    // (unrecognized code) — that's a valid state (routes to Grading Review), not a data error.
    quizCode: text("quiz_code"),

    studentNumber: text("student_number"), // as read, or later corrected; null if unreadable
    ocrTeacherLastName: text("ocr_teacher_last_name"), // raw OCR text, kept for audit/debugging
    resolvedTeacherId: uuid("resolved_teacher_id").references(() => teachers.id),

    answersJson: jsonb("answers_json").notNull().default({}), // e.g. {"1":"B","2":"D",...}

    // Null exactly when quiz_code has no matching answer key — nothing to score against yet.
    scorePercent: numeric("score_percent"),
    passed: boolean("passed"), // score_percent >= 80; null whenever score_percent is null

    // Independent status tracks — see Docs/5-Backend-Schema.md §1 "Grading and
    // teacher-assignment are decoupled." An unmatched quiz code is the one case
    // that blocks grading_status (not just assignment_status).
    gradingStatus: gradingStatusEnum("grading_status").notNull().default("clean"),
    assignmentStatus: assignmentStatusEnum("assignment_status").notNull().default("clean"),

    // e.g. ["smudged_q4", "teacher_title_detected", "roster_mismatch", "unrecognized_quiz_code"]
    flagReasons: jsonb("flag_reasons").notNull().default([]),

    // Storage path in the private scan-images bucket. Retention: deleted once both
    // grading_status and assignment_status are resolved/clean, or 30 days after
    // created_at, whichever comes first (enforced by a scheduled job, not on read).
    scanImageRef: text("scan_image_ref"),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index("test_records_student_number_idx").on(table.studentNumber),
    index("test_records_quiz_code_idx").on(table.quizCode),
    index("test_records_status_idx").on(table.gradingStatus, table.assignmentStatus),
    index("test_records_batch_id_idx").on(table.batchId),
  ]
);

// 2.7 book_reports — auto-created whenever a test_records row has passed = false
// user_id: same treatment as answerKeys.userId above.
export const bookReports = pgTable(
  "book_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id"),
    testRecordId: uuid("test_record_id")
      .notNull()
      .references(() => testRecords.id),
    studentNumber: text("student_number").notNull(), // denormalized for quick lookups
    teacherId: uuid("teacher_id").references(() => teachers.id), // nullable until resolved
    dueDate: date("due_date").notNull(), // date of the failed test
    status: bookReportStatusEnum("status").notNull().default("outstanding"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    // escalation_level is intentionally NOT stored — computed on read as
    // `status = 'outstanding' AND due_date < now() - interval '14 days'`,
    // per Docs/5-Backend-Schema.md §2.7, to avoid a background-job dependency.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [index("book_reports_status_due_date_idx").on(table.status, table.dueDate)]
);

// 2.8 users — intentionally omitted here. The librarian's single login is
// managed by Supabase Auth (auth.users), not a hand-rolled table.

// 2.9 audit_log — cheap insurance since roster edits can retroactively affect history
// user_id: same treatment as answerKeys.userId above — denormalized so a
// correction's audit trail is tenant-scoped too, not just the record itself.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id"),
  action: text("action").notNull(), // e.g. teacher_renamed, teacher_deleted_reassigned
  entityType: text("entity_type").notNull(), // e.g. teacher, student_roster, book_report
  entityId: text("entity_id").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// --- Milestone 1c: accuracy-pilot tooling tables ---
// Not part of Docs/5-Backend-Schema.md (that doc predates this feature) —
// these are internal tooling for the AI-vs-known-score comparison tool
// (Docs/6-Implementation-Plan.md §3), entirely separate from real grading.
// A comparison run never touches test_records, book_reports, or the roster.

export const comparisonRuns = pgTable("comparison_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const comparisonRunItems = pgTable(
  "comparison_run_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => comparisonRuns.id),
    scanOrder: integer("scan_order").notNull(),

    // Same private bucket as real grading (lib/supabase/storage.ts), under a
    // pilot/ prefix. Not subject to test_records' retention policy — these
    // aren't real graded tests, so nothing auto-deletes them.
    scanImageRef: text("scan_image_ref"),

    // Ground truth, from the librarian's CSV (lib/csv/groundTruthImport.ts)
    quizCode: text("quiz_code").notNull(),
    studentNumber: text("student_number").notNull(),
    teacherLastName: text("teacher_last_name").notNull(),
    answersJson: jsonb("answers_json").notNull().default({}),

    // What the AI actually read (lib/anthropic/testSheetRead.ts), unchanged from production
    aiQuizCode: text("ai_quiz_code"),
    aiStudentNumber: text("ai_student_number"),
    aiTeacherLastName: text("ai_teacher_last_name"),
    aiAnswersJson: jsonb("ai_answers_json").notNull().default({}),

    // Derived comparison (lib/grading/compareResult.ts) — typed columns so
    // aggregate accuracy stats can be queried directly, not recomputed from JSON.
    quizCodeMatch: boolean("quiz_code_match").notNull(),
    studentNumberMatch: boolean("student_number_match").notNull(),
    teacherNameMatch: boolean("teacher_name_match").notNull(),
    answerMatchCount: integer("answer_match_count").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    groundTruthScore: numeric("ground_truth_score").notNull(),
    aiScore: numeric("ai_score"), // null when the AI's quiz code didn't match any key
    scoreMatch: boolean("score_match").notNull(),
    wouldHaveBeenClean: boolean("would_have_been_clean").notNull(), // scoreTest() would have flagged nothing
    falseClean: boolean("false_clean").notNull(), // clean AND wrong — the number that matters most (Docs/1-PRD.md §7)

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [index("comparison_run_items_run_id_idx").on(table.runId)]
);
