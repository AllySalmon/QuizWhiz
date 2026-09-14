"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { GradingCorrectionState } from "../actions";

type AnswerChoice = "A" | "B" | "C" | "D";

export function GradingAnswersForm({
  action,
  questions,
  currentAnswers,
  unclearQuestions,
}: {
  action: (state: GradingCorrectionState, formData: FormData) => Promise<GradingCorrectionState>;
  questions: number[];
  currentAnswers: Record<string, AnswerChoice | null>;
  unclearQuestions: Set<number>;
}) {
  const [state, formAction, pending] = useActionState<GradingCorrectionState, FormData>(action, {
    error: null,
  });
  const options: AnswerChoice[] = ["A", "B", "C", "D"];

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {questions.map((questionNumber) => (
        <div
          key={questionNumber}
          className={
            unclearQuestions.has(questionNumber)
              ? "flex items-center gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
              : "flex items-center gap-4 rounded-lg border border-border px-3 py-2"
          }
        >
          <span className="w-6 text-sm text-muted-foreground">{questionNumber}.</span>
          <div className="flex gap-3">
            {options.map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="radio"
                  name={`q_${questionNumber}`}
                  value={option}
                  defaultChecked={currentAnswers[String(questionNumber)] === option}
                  required
                  className="size-4 accent-primary"
                />
                {option}
              </label>
            ))}
          </div>
          {unclearQuestions.has(questionNumber) && (
            <span className="ml-auto text-xs text-destructive">unclear</span>
          )}
        </div>
      ))}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Confirm answers"}
        </Button>
      </div>
    </form>
  );
}
