"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnswerKeyFormState } from "./actions";

type AnswerChoice = "A" | "B" | "C" | "D";

type Props = {
  mode: "create" | "edit";
  action: (state: AnswerKeyFormState, formData: FormData) => Promise<AnswerKeyFormState>;
  initial?: {
    quizCode: string;
    bookTitle: string;
    gradeBand?: "jr" | "3-5";
    // Overrides initial?.questions.length when set — needed when a scanned
    // read (ScanAnswerKeyUpload.tsx) omits low-confidence questions from
    // `questions` but still knows the sheet's real total.
    questionCount?: number;
    questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
  };
};

const initialState: AnswerKeyFormState = { error: null };

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

export function AnswerKeyForm({ mode, action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [questionCount, setQuestionCount] = useState(initial?.questionCount ?? initial?.questions.length ?? 5);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quizCode">Quiz code</Label>
          <Input
            id="quizCode"
            name="quizCode"
            defaultValue={initial?.quizCode}
            readOnly={mode === "edit"}
            required
            className={mode === "edit" ? "cursor-not-allowed bg-input/50 opacity-50" : undefined}
          />
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              Quiz codes can&apos;t be changed once printed on test sheets.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gradeBand">Grade band</Label>
          <Select name="gradeBand" defaultValue={initial?.gradeBand} required>
            <SelectTrigger id="gradeBand" className="w-full">
              {/* See StudentForm.tsx for why this needs an explicit label
                  lookup — Base UI's Select.Value can't resolve one from a
                  closed dropdown's unmounted items. */}
              <SelectValue placeholder="Choose a grade band">
                {(value: "jr" | "3-5" | null) => (value ? GRADE_BAND_LABEL[value] : "Choose a grade band")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jr">SSYRA Jr.</SelectItem>
              <SelectItem value="3-5">SSYRA 3–5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bookTitle">Book title</Label>
        <Input id="bookTitle" name="bookTitle" defaultValue={initial?.bookTitle} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="questionCount">Number of questions</Label>
        <Input
          id="questionCount"
          name="questionCount"
          type="number"
          min={1}
          max={100}
          value={questionCount}
          onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value) || 1))}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-foreground">Correct answers</span>
        {Array.from({ length: questionCount }, (_, i) => i + 1).map((questionNumber) => (
          <QuestionRow
            key={questionNumber}
            questionNumber={questionNumber}
            defaultValue={initial?.questions.find((q) => q.questionNumber === questionNumber)?.correctAnswer}
          />
        ))}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add answer key" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function QuestionRow({
  questionNumber,
  defaultValue,
}: {
  questionNumber: number;
  defaultValue?: AnswerChoice;
}) {
  const name = `q_${questionNumber}`;
  const options: AnswerChoice[] = ["A", "B", "C", "D"];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border px-3 py-2">
      <span className="w-6 text-sm text-muted-foreground">{questionNumber}.</span>
      <div className="flex gap-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-sm text-foreground">
            <input
              type="radio"
              name={name}
              value={option}
              defaultChecked={defaultValue === option}
              required
              className="size-4 accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}
