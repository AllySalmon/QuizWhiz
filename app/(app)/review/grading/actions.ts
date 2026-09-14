"use server";

import { redirect } from "next/navigation";
import { getTestRecord, correctQuizCode, correctAnswers } from "@/lib/db/queries/testRecords";
import { getAnswerKeyByQuizCode } from "@/lib/db/queries/answerKeys";
import type { AnswerChoice } from "@/lib/db/queries/answerKeys";

export type GradingCorrectionState = { error: string | null };

function backTo(batchId: string | null): never {
  redirect(batchId ? `/review/grading?batch=${batchId}` : "/review/grading");
}

export async function correctQuizCodeAction(
  id: string,
  batchId: string | null,
  _prevState: GradingCorrectionState,
  formData: FormData
): Promise<GradingCorrectionState> {
  const newQuizCode = formData.get("quizCode");
  if (typeof newQuizCode !== "string" || !newQuizCode.trim()) {
    return { error: "Enter a quiz code." };
  }

  const matchedKey = await getAnswerKeyByQuizCode(newQuizCode.trim());
  await correctQuizCode(
    id,
    newQuizCode.trim(),
    matchedKey?.questions.map((q) => ({ questionNumber: q.questionNumber, correctAnswer: q.correctAnswer })) ?? null
  );

  if (!matchedKey) {
    return { error: "Still no answer key matches that code. Add the key first, or double-check it." };
  }

  backTo(batchId);
}

export async function correctAnswersAction(
  id: string,
  batchId: string | null,
  _prevState: GradingCorrectionState,
  formData: FormData
): Promise<GradingCorrectionState> {
  const record = await getTestRecord(id);
  if (!record || !record.quizCode) return { error: "This test record can't be found." };

  const matchedKey = await getAnswerKeyByQuizCode(record.quizCode);
  if (!matchedKey) return { error: "The matched answer key is missing — try re-checking the quiz code." };

  const correctedAnswers: { questionNumber: number; selected: AnswerChoice }[] = [];
  for (const q of matchedKey.questions) {
    const value = formData.get(`q_${q.questionNumber}`);
    if (typeof value !== "string" || !["A", "B", "C", "D"].includes(value)) {
      return { error: `Question ${q.questionNumber} needs an answer selected.` };
    }
    correctedAnswers.push({ questionNumber: q.questionNumber, selected: value as AnswerChoice });
  }

  await correctAnswers(
    id,
    correctedAnswers,
    matchedKey.questions.map((q) => ({ questionNumber: q.questionNumber, correctAnswer: q.correctAnswer }))
  );

  backTo(batchId);
}
