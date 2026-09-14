"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GradingCorrectionState } from "../actions";

export function QuizCodeCorrectionForm({
  action,
  initialValue,
}: {
  action: (state: GradingCorrectionState, formData: FormData) => Promise<GradingCorrectionState>;
  initialValue: string;
}) {
  const [state, formAction, pending] = useActionState<GradingCorrectionState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quizCode">Quiz code</Label>
        <Input id="quizCode" name="quizCode" defaultValue={initialValue} required className="max-w-xs" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Re-check code"}
        </Button>
      </div>
    </form>
  );
}
