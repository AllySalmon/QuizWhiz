"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { csvImportAnswerKeysAction, type AnswerKeyCsvImportState } from "./actions";

const initialState: AnswerKeyCsvImportState = { error: null, summary: null };

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(csvImportAnswerKeysAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Import from CSV</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        One row per book. Columns: <code className="rounded bg-muted px-1 py-0.5">quiz_code</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">book_title</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">grade_band</code> (
        <code className="rounded bg-muted px-1 py-0.5">jr</code> or{" "}
        <code className="rounded bg-muted px-1 py-0.5">3-5</code>), then one column per question:{" "}
        <code className="rounded bg-muted px-1 py-0.5">q1</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">q2</code>, … each holding A/B/C/D.
      </p>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-3 flex items-center gap-3"
      >
        <input
          type="file"
          name="csvFile"
          accept=".csv,text/csv"
          required
          className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      {state.summary && (
        <Alert className="mt-3">
          <AlertTitle>
            {state.summary.applied.length} added
            {totalSkipped(state.summary) > 0 ? `, ${totalSkipped(state.summary)} skipped` : ""}
            {` (found ${state.summary.questionColumnsFound} question columns)`}
          </AlertTitle>
          {totalSkipped(state.summary) > 0 && (
            <AlertDescription>
              {state.summary.skipped.duplicateExisting > 0 &&
                `${state.summary.skipped.duplicateExisting} quiz code already exists. `}
              {state.summary.skipped.duplicateInFile > 0 &&
                `${state.summary.skipped.duplicateInFile} duplicated within the file. `}
              {state.summary.skipped.missingRequiredField > 0 &&
                `${state.summary.skipped.missingRequiredField} missing quiz code/title/grade band. `}
              {state.summary.skipped.invalidAnswer > 0 &&
                `${state.summary.skipped.invalidAnswer} had a missing or invalid answer (not A/B/C/D).`}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}

function totalSkipped(summary: NonNullable<AnswerKeyCsvImportState["summary"]>) {
  return (
    summary.skipped.missingRequiredField +
    summary.skipped.duplicateExisting +
    summary.skipped.duplicateInFile +
    summary.skipped.invalidAnswer
  );
}
