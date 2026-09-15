import "server-only";
import { eq, asc, ilike } from "drizzle-orm";
import { getDb } from "../client";
import { answerKeys, answerKeyQuestions } from "../schema";

export type AnswerChoice = "A" | "B" | "C" | "D";
export type GradeBand = "jr" | "3-5";

export async function listAnswerKeys() {
  const db = getDb();
  return db.select().from(answerKeys).orderBy(asc(answerKeys.bookTitle));
}

export async function getAnswerKeyWithQuestions(id: string) {
  const db = getDb();
  const [key] = await db.select().from(answerKeys).where(eq(answerKeys.id, id));
  if (!key) return null;

  const questions = await db
    .select()
    .from(answerKeyQuestions)
    .where(eq(answerKeyQuestions.answerKeyId, id))
    .orderBy(asc(answerKeyQuestions.questionNumber));

  return { ...key, questions };
}

// Looked up once per graded image, by the quiz code read off the sheet
// (case-insensitive, trimmed — handwriting/print variance shouldn't cause
// an otherwise-correct code to miss).
export async function getAnswerKeyByQuizCode(quizCode: string) {
  const db = getDb();
  const [key] = await db.select().from(answerKeys).where(ilike(answerKeys.quizCode, quizCode.trim()));
  if (!key) return null;

  const questions = await db
    .select()
    .from(answerKeyQuestions)
    .where(eq(answerKeyQuestions.answerKeyId, key.id))
    .orderBy(asc(answerKeyQuestions.questionNumber));

  return { ...key, questions };
}

export async function createAnswerKey(input: {
  quizCode: string;
  bookTitle: string;
  gradeBand: GradeBand;
  questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
}) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [key] = await tx
      .insert(answerKeys)
      .values({
        quizCode: input.quizCode,
        bookTitle: input.bookTitle,
        gradeBand: input.gradeBand,
        questionCount: input.questions.length,
      })
      .returning();

    if (input.questions.length > 0) {
      await tx.insert(answerKeyQuestions).values(
        input.questions.map((q) => ({
          answerKeyId: key.id,
          questionNumber: q.questionNumber,
          correctAnswer: q.correctAnswer,
        }))
      );
    }

    return key;
  });
}

// Replaces the full question set on save. In Milestone 1b this is where a
// "N tests used this key — recompute their scores?" confirmation hooks in
// (Docs/1-PRD.md §5.1) — no test_records exist yet for this to affect.
export async function updateAnswerKey(
  id: string,
  input: {
    bookTitle: string;
    gradeBand: GradeBand;
    questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
  }
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [key] = await tx
      .update(answerKeys)
      .set({
        bookTitle: input.bookTitle,
        gradeBand: input.gradeBand,
        questionCount: input.questions.length,
        updatedAt: new Date(),
      })
      .where(eq(answerKeys.id, id))
      .returning();

    await tx.delete(answerKeyQuestions).where(eq(answerKeyQuestions.answerKeyId, id));

    if (input.questions.length > 0) {
      await tx.insert(answerKeyQuestions).values(
        input.questions.map((q) => ({
          answerKeyId: id,
          questionNumber: q.questionNumber,
          correctAnswer: q.correctAnswer,
        }))
      );
    }

    return key;
  });
}

export async function listQuizCodes() {
  const db = getDb();
  const rows = await db.select({ quizCode: answerKeys.quizCode }).from(answerKeys);
  return rows.map((r) => r.quizCode);
}

// For the accuracy pilot's ground-truth CSV validation (lib/csv/groundTruthImport.ts)
// — each row's required answer columns depend on its own quiz code's real
// question count, not a count assumed from the CSV's header alone.
export async function listQuizCodeQuestionCounts() {
  const db = getDb();
  const rows = await db.select({ quizCode: answerKeys.quizCode, questionCount: answerKeys.questionCount }).from(answerKeys);
  return rows;
}

// Used by the CSV import (lib/csv/answerKeyImport.ts) after it has already
// filtered out invalid/duplicate rows. Each key gets its own transaction via
// createAnswerKey — fine at CSV-batch scale, no need for one giant transaction.
export async function createManyAnswerKeys(
  rows: {
    quizCode: string;
    bookTitle: string;
    gradeBand: GradeBand;
    questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
  }[]
) {
  for (const row of rows) {
    await createAnswerKey(row);
  }
  return rows.length;
}

export async function answerKeysExist() {
  const db = getDb();
  const [row] = await db.select({ id: answerKeys.id }).from(answerKeys).limit(1);
  return Boolean(row);
}
