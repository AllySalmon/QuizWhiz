import Papa from "papaparse";
import type { AnswerChoice } from "@/lib/db/queries/answerKeys";

// Same wide-format shape as lib/csv/answerKeyImport.ts — one row per test,
// one column per question. Rows are matched to uploaded images BY POSITION
// (row 1 = the first image selected), same as scan_order in real grading —
// not by filename, which would be fragile.
//
// IMPORTANT naming distinction from answerKeyImport.ts: q1..qN here are
// what the student actually circled, as she read it by hand off the sheet
// — NOT "the correct answer." Scoring against the stored answer key still
// determines correct/incorrect; ground truth is what to compare the AI's
// *read* against, not a second copy of the key.

export type GroundTruthRow = {
  quizCode: string;
  studentNumber: string;
  teacherLastName: string;
  answers: { questionNumber: number; circled: AnswerChoice }[];
};

export type GroundTruthRowError = {
  rowNumber: number; // 1-based, matches CSV data row order (header excluded)
  message: string;
};

export type GroundTruthParseResult = {
  rows: (GroundTruthRow | null)[]; // null = that row failed to parse; index = position
  rowErrors: GroundTruthRowError[]; // one entry per failed row, naming the actual problem
  error: string | null; // header-level error (no question columns at all)
};

const VALID_ANSWERS: AnswerChoice[] = ["A", "B", "C", "D"];

// quizCodeQuestionCounts: real answer-key question counts (quiz code,
// uppercased+trimmed -> questionCount), fetched by the caller from
// GET /api/answer-keys/quiz-codes. Each row is validated against ITS OWN
// quiz code's real question count — not a count assumed from the CSV's
// header — so a file mixing a 5-question and an 8-question quiz validates
// each row correctly instead of every shorter row failing on the longer
// quiz's trailing columns.
export function parseGroundTruthCsv(
  csvText: string,
  quizCodeQuestionCounts: Map<string, number>
): GroundTruthParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const hasQuestionColumn = (parsed.meta.fields ?? []).some((f) => /^q\d+$/.test(f));
  if (!hasQuestionColumn) {
    return {
      rows: [],
      rowErrors: [],
      error: 'No question columns found. Add columns named "q1", "q2", etc.',
    };
  }

  const rowErrors: GroundTruthRowError[] = [];

  const rows = parsed.data.map((row, index): GroundTruthRow | null => {
    const rowNumber = index + 1;
    const quizCode = row.quiz_code?.trim();
    const studentNumber = row.student_number?.trim();
    const teacherLastName = row.teacher_last_name?.trim();
    if (!quizCode || !studentNumber || !teacherLastName) {
      rowErrors.push({
        rowNumber,
        message: `Row ${rowNumber} is missing quiz_code, student_number, or teacher_last_name.`,
      });
      return null;
    }

    const expectedCount = quizCodeQuestionCounts.get(quizCode.toUpperCase());
    if (expectedCount === undefined) {
      rowErrors.push({
        rowNumber,
        message: `Row ${rowNumber}: quiz code "${quizCode}" isn't a recognized answer key — add it under Answer Keys first, or check for a typo.`,
      });
      return null;
    }

    const answers: { questionNumber: number; circled: AnswerChoice }[] = [];
    for (let questionNumber = 1; questionNumber <= expectedCount; questionNumber++) {
      const column = `q${questionNumber}`;
      const value = row[column]?.trim().toUpperCase();
      if (!value || !VALID_ANSWERS.includes(value as AnswerChoice)) {
        rowErrors.push({
          rowNumber,
          message: `Row ${rowNumber}: ${column} is blank or not A/B/C/D (quiz code ${quizCode} expects ${expectedCount} answer${expectedCount === 1 ? "" : "s"}).`,
        });
        return null;
      }
      answers.push({ questionNumber, circled: value as AnswerChoice });
    }

    return { quizCode, studentNumber, teacherLastName, answers };
  });

  return { rows, rowErrors, error: null };
}
