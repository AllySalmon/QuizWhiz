import Papa from "papaparse";
import type { AnswerChoice, GradeBand } from "@/lib/db/queries/answerKeys";

// Wide format, per the user's Milestone 1a decision: one row per answer key,
// one column per question. Columns: quiz_code, book_title, grade_band,
// q1, q2, q3, ... (as many q<N> columns as the book has questions — no
// fixed count, detected from the header). New scope beyond Docs/ (only
// students had a documented CSV format).

export type ExistingQuizCode = string;

export type AnswerKeyImportRow = {
  quizCode: string;
  bookTitle: string;
  gradeBand: GradeBand;
  questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
};

export type AnswerKeyImportSummary = {
  totalRows: number;
  questionColumnsFound: number;
  applied: AnswerKeyImportRow[];
  skipped: {
    missingRequiredField: number;
    duplicateExisting: number;
    duplicateInFile: number;
    invalidAnswer: number;
  };
};

const VALID_GRADE_BANDS: GradeBand[] = ["jr", "3-5"];
const VALID_ANSWERS: AnswerChoice[] = ["A", "B", "C", "D"];

export function parseAnswerKeyCsv(csvText: string, existingQuizCodes: ExistingQuizCode[]): AnswerKeyImportSummary {
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

  const existingSet = new Set(existingQuizCodes.map((c) => c.trim().toLowerCase()));
  const seenInFile = new Set<string>();

  const summary: AnswerKeyImportSummary = {
    totalRows: parsed.data.length,
    questionColumnsFound: questionColumns.length,
    applied: [],
    skipped: { missingRequiredField: 0, duplicateExisting: 0, duplicateInFile: 0, invalidAnswer: 0 },
  };

  for (const row of parsed.data) {
    const quizCode = row.quiz_code?.trim();
    const bookTitle = row.book_title?.trim();
    const gradeBand = row.grade_band?.trim() as GradeBand | undefined;

    if (!quizCode || !bookTitle || !gradeBand || !VALID_GRADE_BANDS.includes(gradeBand)) {
      summary.skipped.missingRequiredField++;
      continue;
    }

    const key = quizCode.toLowerCase();
    if (existingSet.has(key)) {
      summary.skipped.duplicateExisting++;
      continue;
    }
    if (seenInFile.has(key)) {
      summary.skipped.duplicateInFile++;
      continue;
    }

    const questions: { questionNumber: number; correctAnswer: AnswerChoice }[] = [];
    let invalid = false;
    for (const { column, questionNumber } of questionColumns) {
      const value = row[column]?.trim().toUpperCase();
      if (!value || !VALID_ANSWERS.includes(value as AnswerChoice)) {
        invalid = true;
        break;
      }
      questions.push({ questionNumber, correctAnswer: value as AnswerChoice });
    }

    if (invalid || questions.length === 0) {
      summary.skipped.invalidAnswer++;
      continue;
    }

    seenInFile.add(key);
    summary.applied.push({ quizCode, bookTitle, gradeBand, questions });
  }

  return summary;
}
