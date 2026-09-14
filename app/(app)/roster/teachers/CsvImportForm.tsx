"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { csvImportTeachersAction, type TeacherCsvImportState } from "./actions";

const initialState: TeacherCsvImportState = { error: null, summary: null };

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(csvImportTeachersAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Import from CSV</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Columns: <code className="rounded bg-muted px-1 py-0.5">first_name</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5">last_name</code>. Rows matching an existing
        teacher (or another row in the same file) are skipped, not overwritten.
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
          </AlertTitle>
          {totalSkipped(state.summary) > 0 && (
            <AlertDescription>
              {state.summary.skipped.duplicateExisting > 0 &&
                `${state.summary.skipped.duplicateExisting} already exist. `}
              {state.summary.skipped.duplicateInFile > 0 &&
                `${state.summary.skipped.duplicateInFile} duplicated within the file. `}
              {state.summary.skipped.missingName > 0 &&
                `${state.summary.skipped.missingName} missing a name.`}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}

function totalSkipped(summary: NonNullable<TeacherCsvImportState["summary"]>) {
  return (
    summary.skipped.missingName + summary.skipped.duplicateInFile + summary.skipped.duplicateExisting
  );
}
