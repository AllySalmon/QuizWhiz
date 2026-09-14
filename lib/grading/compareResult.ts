// Pure, DB-free — same shape as scoreTest.ts. Compares one AI read against
// one ground-truth row (Docs/6-Implementation-Plan.md §3's accuracy pilot).
import type { TestSheetRead } from "@/lib/anthropic/testSheetRead";
import type { AnswerChoice } from "@/lib/db/queries/answerKeys";
import type { GroundTruthRow } from "@/lib/csv/groundTruthImport";
import { scoreTest } from "./scoreTest";

export type CompareResultInput = {
  read: TestSheetRead;
  groundTruth: GroundTruthRow;
  // The key matched via the AI's read.quizCode — may differ from the
  // ground-truth key if the AI misread the code. null = no match.
  aiMatchedKeyQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[] | null;
  // The key matched via groundTruth.quizCode — should essentially always
  // resolve, since she's entering a code that's really on the sheet.
  groundTruthMatchedKeyQuestions: { questionNumber: number; correctAnswer: AnswerChoice }[] | null;
};

export type CompareResult = {
  quizCodeMatch: boolean;
  studentNumberMatch: boolean;
  teacherNameMatch: boolean;
  answerMatchCount: number; // AI's read vs. what she says was actually circled — reading accuracy, independent of key correctness
  totalQuestions: number;
  groundTruthScore: number; // circled answers vs. the key, no confidence involved
  aiScore: number | null; // null when the AI's quiz code matched no key
  scoreMatch: boolean;
  wouldHaveBeenClean: boolean; // what scoreTest() would have produced for this AI read
  falseClean: boolean; // clean AND wrong — the metric that matters most (Docs/1-PRD.md §7)
};

const SCORE_EPSILON = 0.01;

export function compareResult(input: CompareResultInput): CompareResult {
  const { read, groundTruth, aiMatchedKeyQuestions, groundTruthMatchedKeyQuestions } = input;

  const quizCodeMatch =
    read.quizCode.value?.trim().toUpperCase() === groundTruth.quizCode.trim().toUpperCase();
  const studentNumberMatch = read.studentNumber.value?.trim() === groundTruth.studentNumber.trim();
  const teacherNameMatch =
    read.teacherLastName.value?.trim().toLowerCase() === groundTruth.teacherLastName.trim().toLowerCase();

  const circledByQuestion = new Map(groundTruth.answers.map((a) => [a.questionNumber, a.circled]));
  let answerMatchCount = 0;
  for (const a of read.answers) {
    if (a.selected !== null && a.selected === circledByQuestion.get(a.questionNumber)) answerMatchCount++;
  }

  // Ground-truth score: plain arithmetic against the key her quiz code
  // resolves to — no confidence data to reason about, unlike scoreTest().
  let groundTruthScore = 0;
  if (groundTruthMatchedKeyQuestions && groundTruthMatchedKeyQuestions.length > 0) {
    let correct = 0;
    for (const q of groundTruthMatchedKeyQuestions) {
      if (circledByQuestion.get(q.questionNumber) === q.correctAnswer) correct++;
    }
    groundTruthScore = (correct / groundTruthMatchedKeyQuestions.length) * 100;
  }

  // Simulate a roster lookup: a real lookup would only find this student if
  // the AI actually read their number correctly (Milestone 1c plan).
  const simulatedRosterTeacherId = studentNumberMatch ? "ground-truth" : null;
  const simulatedRosterTeacherLastName = studentNumberMatch ? groundTruth.teacherLastName : null;

  const scored = scoreTest({
    read,
    answerKeyQuestions: aiMatchedKeyQuestions,
    rosterTeacherId: simulatedRosterTeacherId,
    rosterTeacherLastName: simulatedRosterTeacherLastName,
  });

  const aiScore = scored.scorePercent;
  const scoreMatch = aiScore !== null && Math.abs(aiScore - groundTruthScore) < SCORE_EPSILON;
  const wouldHaveBeenClean = scored.gradingStatus === "clean" && scored.assignmentStatus === "clean";
  const falseClean = wouldHaveBeenClean && !scoreMatch;

  return {
    quizCodeMatch,
    studentNumberMatch,
    teacherNameMatch,
    answerMatchCount,
    totalQuestions: groundTruth.answers.length,
    groundTruthScore,
    aiScore,
    scoreMatch,
    wouldHaveBeenClean,
    falseClean,
  };
}
