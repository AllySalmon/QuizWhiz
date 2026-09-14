"use server";

import { redirect } from "next/navigation";
import {
  createAnswerKey,
  updateAnswerKey,
  listQuizCodes,
  createManyAnswerKeys,
  type AnswerChoice,
  type GradeBand,
} from "@/lib/db/queries/answerKeys";
import { parseAnswerKeyCsv, type AnswerKeyImportSummary } from "@/lib/csv/answerKeyImport";

export type AnswerKeyFormState = { error: string | null };

function readQuestions(formData: FormData, count: number) {
  const questions: { questionNumber: number; correctAnswer: AnswerChoice }[] = [];
  for (let i = 1; i <= count; i++) {
    const answer = formData.get(`q_${i}`);
    if (typeof answer !== "string" || !["A", "B", "C", "D"].includes(answer)) {
      throw new Error(`Question ${i} needs an answer selected.`);
    }
    questions.push({ questionNumber: i, correctAnswer: answer as AnswerChoice });
  }
  return questions;
}

// Postgres unique_violation — see the answer_keys.quiz_code unique constraint
// (Docs/5-Backend-Schema.md §2.3). drizzle-orm/postgres-js wraps the actual
// PostgresError inside `.cause`, not on the thrown error itself — the code
// lives at error.cause.code, confirmed against a live duplicate-insert.
function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === "object" && value !== null && "code" in value && value.code === code;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    hasErrorCode(error, "23505") ||
    (error instanceof Error && hasErrorCode(error.cause, "23505"))
  );
}

export async function createAnswerKeyAction(
  _prevState: AnswerKeyFormState,
  formData: FormData
): Promise<AnswerKeyFormState> {
  const quizCode = formData.get("quizCode");
  const bookTitle = formData.get("bookTitle");
  const gradeBand = formData.get("gradeBand");
  const questionCount = Number(formData.get("questionCount"));

  if (typeof quizCode !== "string" || !quizCode.trim()) {
    return { error: "Enter a quiz code." };
  }
  if (typeof bookTitle !== "string" || !bookTitle.trim()) {
    return { error: "Enter a book title." };
  }
  if (gradeBand !== "jr" && gradeBand !== "3-5") {
    return { error: "Choose a grade band." };
  }
  if (!Number.isInteger(questionCount) || questionCount < 1) {
    return { error: "Enter a number of questions (1 or more)." };
  }

  let questions;
  try {
    questions = readQuestions(formData, questionCount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Every question needs an answer." };
  }

  try {
    await createAnswerKey({
      quizCode: quizCode.trim(),
      bookTitle: bookTitle.trim(),
      gradeBand: gradeBand as GradeBand,
      questions,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "That quiz code is already in use — choose a different one." };
    }
    throw err;
  }

  redirect("/answer-keys");
}

export async function updateAnswerKeyAction(
  id: string,
  _prevState: AnswerKeyFormState,
  formData: FormData
): Promise<AnswerKeyFormState> {
  const bookTitle = formData.get("bookTitle");
  const gradeBand = formData.get("gradeBand");
  const questionCount = Number(formData.get("questionCount"));

  if (typeof bookTitle !== "string" || !bookTitle.trim()) {
    return { error: "Enter a book title." };
  }
  if (gradeBand !== "jr" && gradeBand !== "3-5") {
    return { error: "Choose a grade band." };
  }
  if (!Number.isInteger(questionCount) || questionCount < 1) {
    return { error: "Enter a number of questions (1 or more)." };
  }

  let questions;
  try {
    questions = readQuestions(formData, questionCount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Every question needs an answer." };
  }

  await updateAnswerKey(id, { bookTitle: bookTitle.trim(), gradeBand: gradeBand as GradeBand, questions });

  redirect("/answer-keys");
}

export type AnswerKeyCsvImportState = { error: string | null; summary: AnswerKeyImportSummary | null };

export async function csvImportAnswerKeysAction(
  _prevState: AnswerKeyCsvImportState,
  formData: FormData
): Promise<AnswerKeyCsvImportState> {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file.", summary: null };
  }

  const text = await file.text();
  const existingQuizCodes = await listQuizCodes();
  const result = parseAnswerKeyCsv(text, existingQuizCodes);

  if (result.questionColumnsFound === 0) {
    return {
      error: 'No question columns found. Add columns named "q1", "q2", etc. — one per question.',
      summary: null,
    };
  }

  await createManyAnswerKeys(result.applied);

  return { error: null, summary: result };
}
