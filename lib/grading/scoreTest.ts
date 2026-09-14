// Pure, DB-free scoring/status logic — same shape as lib/csv/*.ts. The AI's
// job (lib/anthropic/testSheetRead.ts) is only reading the sheet; deciding
// what counts as correct, and what needs review, happens here in plain code
// (Docs/3-Tech-Stack.md §3).
import type { TestSheetRead } from "@/lib/anthropic/testSheetRead";
import type { AnswerChoice } from "@/lib/db/queries/answerKeys";

export type GradingStatus = "clean" | "needs_grading_review";
export type AssignmentStatus = "clean" | "needs_assignment_review";

export type ScoreTestInput = {
  read: TestSheetRead;
  answerKeyQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[] | null; // null = quiz code unmatched/unreadable
  rosterTeacherId: string | null; // student_roster.teacher_id for this student number, if found in roster
  rosterTeacherLastName: string | null; // that teacher's last name, for the OCR cross-check
};

export type ScoreTestResult = {
  scorePercent: number | null;
  passed: boolean | null;
  gradingStatus: GradingStatus;
  assignmentStatus: AssignmentStatus;
  flagReasons: string[];
  resolvedTeacherId: string | null;
};

const TITLE_PATTERN = /\b(mr|mrs|ms|miss)\.?\b/i;

export function scoreTest(input: ScoreTestInput): ScoreTestResult {
  const flagReasons: string[] = [];

  // --- Grading (answers vs. the key) ---
  let scorePercent: number | null = null;
  let passed: boolean | null = null;
  let gradingStatus: GradingStatus = "clean";

  if (input.answerKeyQuestions === null) {
    // Docs/1-PRD.md §5.4: the one case that blocks grading itself — no key
    // to score against, unlike every other unreadable/uncertain field.
    gradingStatus = "needs_grading_review";
    flagReasons.push("unrecognized_quiz_code");
  } else {
    const answersByQuestion = new Map(input.read.answers.map((a) => [a.questionNumber, a]));
    let correctCount = 0;

    for (const question of input.answerKeyQuestions) {
      const answer = answersByQuestion.get(question.questionNumber);
      const isUnclear = !answer || answer.selected === null || answer.confidence === "low";

      if (isUnclear) {
        flagReasons.push(`unclear_answer_q${question.questionNumber}`);
      } else if (answer!.selected === question.correctAnswer) {
        correctCount++;
      }
    }

    const total = input.answerKeyQuestions.length;
    scorePercent = total > 0 ? (correctCount / total) * 100 : 0;
    passed = scorePercent >= 80;
    gradingStatus = flagReasons.length > 0 ? "needs_grading_review" : "clean";
  }

  // --- Assignment (student number / teacher) ---
  let assignmentStatus: AssignmentStatus = "clean";
  let resolvedTeacherId: string | null = null;

  const studentNumberOk = input.read.studentNumber.value !== null && input.read.studentNumber.confidence === "high";
  const hasTitle = input.read.teacherLastName.value !== null && TITLE_PATTERN.test(input.read.teacherLastName.value);

  if (!studentNumberOk) {
    assignmentStatus = "needs_assignment_review";
    flagReasons.push("unreadable_student_number");
  } else if (input.rosterTeacherId === null) {
    assignmentStatus = "needs_assignment_review";
    flagReasons.push("student_not_in_roster");
  }

  // Title detection and the roster cross-check are mutually exclusive: a
  // title prefix means "the name underneath may not be reliably parsed"
  // (Docs/1-PRD.md §5.2) — we don't also guess at a mismatch under it.
  if (hasTitle) {
    assignmentStatus = "needs_assignment_review";
    flagReasons.push("teacher_title_detected");
  } else if (
    studentNumberOk &&
    input.rosterTeacherId !== null &&
    input.rosterTeacherLastName !== null &&
    input.read.teacherLastName.value !== null &&
    input.read.teacherLastName.value.trim().toLowerCase() !== input.rosterTeacherLastName.trim().toLowerCase()
  ) {
    assignmentStatus = "needs_assignment_review";
    flagReasons.push("roster_mismatch");
  }

  // Only commit to a teacher when nothing about the assignment is in doubt —
  // "so a report never contains a guess" (Docs/1-PRD.md §5.6).
  if (assignmentStatus === "clean") {
    resolvedTeacherId = input.rosterTeacherId;
  }

  return { scorePercent, passed, gradingStatus, assignmentStatus, flagReasons, resolvedTeacherId };
}
