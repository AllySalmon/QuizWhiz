"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { csvImportAction, type CsvImportState } from "./actions";

const initialState: CsvImportState = { error: null, summary: null };

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(csvImportAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Import from CSV</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Columns: <code className="rounded bg-muted px-1 py-0.5">student_number</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">teacher_last_name</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">grade_band</code> (
        <code className="rounded bg-muted px-1 py-0.5">jr</code> or{" "}
        <code className="rounded bg-muted px-1 py-0.5">3-5</code>). Existing student numbers get their
        teacher updated; new ones are added. Nothing is deleted.
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
            {state.summary.applied.length} updated
            {totalSkipped(state.summary) > 0 ? `, ${totalSkipped(state.summary)} skipped` : ""}
          </AlertTitle>
          {totalSkipped(state.summary) > 0 && (
            <AlertDescription>
              {state.summary.skipped.unrecognizedTeacher > 0 &&
                `${state.summary.skipped.unrecognizedTeacher} unrecognized teacher. `}
              {state.summary.skipped.ambiguousTeacherName > 0 &&
                `${state.summary.skipped.ambiguousTeacherName} ambiguous teacher name (matches multiple teachers). `}
              {state.summary.skipped.invalidGradeBand > 0 &&
                `${state.summary.skipped.invalidGradeBand} invalid grade band. `}
              {state.summary.skipped.missingStudentNumber > 0 &&
                `${state.summary.skipped.missingStudentNumber} missing student number.`}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}

function totalSkipped(summary: NonNullable<CsvImportState["summary"]>) {
  return (
    summary.skipped.missingStudentNumber +
    summary.skipped.invalidGradeBand +
    summary.skipped.unrecognizedTeacher +
    summary.skipped.ambiguousTeacherName
  );
}
