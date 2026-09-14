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

export type GroundTruthParseResult = {
  rows: (GroundTruthRow | null)[]; // null = that row failed to parse; index = position
  error: string | null;
};

const VALID_ANSWERS: AnswerChoice[] = ["A", "B", "C", "D"];

export function parseGroundTruthCsv(csvText: string): GroundTruthParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const questionColumns = (parsed.meta.fields ?? [])
    .map((f) => /^q(\d+)$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ column: m[0], questionNumber: Number(m[1]) }))
    .sort((a, b) => a.questionNumber - b.questionNumber);

  if (questionColumns.length === 0) {
    return { rows: [], error: 'No question columns found. Add columns named "q1", "q2", etc.' };
  }

  const rows = parsed.data.map((row): GroundTruthRow | null => {
    const quizCode = row.quiz_code?.trim();
    const studentNumber = row.student_number?.trim();
    const teacherLastName = row.teacher_last_name?.trim();
    if (!quizCode || !studentNumber || !teacherLastName) return null;

    const answers: { questionNumber: number; circled: AnswerChoice }[] = [];
    for (const { column, questionNumber } of questionColumns) {
      const value = row[column]?.trim().toUpperCase();
      if (!value || !VALID_ANSWERS.includes(value as AnswerChoice)) return null;
      answers.push({ questionNumber, circled: value as AnswerChoice });
    }

    return { quizCode, studentNumber, teacherLastName, answers };
  });

  return { rows, error: null };
}
