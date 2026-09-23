"use server";

import { redirect } from "next/navigation";
import {
  createAnswerKey,
  updateAnswerKey,
  deleteAnswerKey,
  listQuizCodes,
  createManyAnswerKeys,
  type AnswerChoice,
  type GradeBand,
} from "@/lib/db/queries/answerKeys";
import { reconcileTestsForNewAnswerKey } from "@/lib/db/queries/testRecords";
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
// (Docs/5-Backend-Schema.md §2.3). Two different error shapes land here now
// that lib/db/queries/answerKeys.ts queries via the Supabase client instead
// of Drizzle: a thrown PostgrestError has `.code` directly on it (the first
// check below), while any other Drizzle-based path in this app still wraps
// the real PostgresError inside `.cause` (the second check) — both handled,
// confirmed against a live duplicate-insert through the new code path.
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

  // "If the answer key is updated, the test should process as normal" — any
  // test stuck in Grading Review waiting on exactly this quiz code resolves
  // itself now, without her also having to manually re-correct each one.
  await reconcileTestsForNewAnswerKey(quizCode.trim(), questions);

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

export async function deleteAnswerKeyAction(id: string) {
  await deleteAnswerKey(id);
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

  // A real point of confusion once the photo/PDF scan reader shipped
  // (app/(app)/answer-keys/ScanAnswerKeyUpload.tsx, on /answer-keys/new) —
  // dropping a PDF/photo in here instead used to fall through to "No
  // question columns found," which doesn't say what actually went wrong or
  // where the file the user meant to use actually belongs.
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") || file.type.startsWith("image/")) {
    return {
      error:
        'This box is for CSV bulk import only. For a single answer key from a photo or PDF, use "Add answer key" instead — it has a scan/upload option that reads it with AI.',
      summary: null,
    };
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

  // Same reconciliation as the one-at-a-time form — a bulk import can just
  // as easily be the thing that finally supplies a previously-missing code.
  for (const key of result.applied) {
    await reconcileTestsForNewAnswerKey(key.quizCode, key.questions);
  }

  return { error: null, summary: result };
}
