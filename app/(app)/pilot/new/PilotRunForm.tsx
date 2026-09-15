"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { parseGroundTruthCsv, type GroundTruthRow, type GroundTruthRowError } from "@/lib/csv/groundTruthImport";
import { tryNormalizeImageForUpload } from "@/lib/media/normalizeImage";
import { useExpandableFileQueue } from "@/lib/media/useExpandableFileQueue";
import { cn } from "@/lib/utils";

const CONCURRENCY = 3;

function formatRunLabel(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Accuracy check — ${weekday} ${day}, ${time}`;
}

type Preview = {
  rows: (GroundTruthRow | null)[];
  rowErrors: GroundTruthRowError[];
  error: string | null;
};

export function PilotRunForm() {
  const router = useRouter();
  const {
    inputRef: imagesRef,
    files: images,
    preparing,
    error,
    setError,
    handleFilesSelected,
    removeFile,
  } = useExpandableFileQueue();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [quizCodeCounts, setQuizCodeCounts] = useState<Map<string, number> | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<{ name: string; message: string }[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  // Real per-quiz-code question counts, fetched once — used both to
  // validate the CSV (lib/csv/groundTruthImport.ts) and to build the
  // pairing preview below, so a mismatch (mixed question counts, an
  // unrecognized quiz code, or a row/image count mismatch caused by a
  // remove-and-re-add reordering the queue) is visible before anything runs
  // instead of surfacing as a submit-time error.
  useEffect(() => {
    fetch("/api/answer-keys/quiz-codes")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) return;
        setQuizCodeCounts(
          new Map(
            (json.quizCodes as { quizCode: string; questionCount: number }[]).map((k) => [
              k.quizCode.trim().toUpperCase(),
              k.questionCount,
            ])
          )
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!csvFile || !quizCodeCounts) {
      setPreview(null);
      return;
    }
    csvFile.text().then((text) => {
      if (cancelled) return;
      setPreview(parseGroundTruthCsv(text, quizCodeCounts));
    });
    return () => {
      cancelled = true;
    };
  }, [csvFile, quizCodeCounts]);

  const previewRowCount = preview ? Math.max(preview.rows.length, images.length) : images.length;
  const canRun =
    images.length > 0 &&
    csvFile !== null &&
    preview !== null &&
    preview.error === null &&
    preview.rowErrors.length === 0 &&
    preview.rows.length === images.length;

  async function start() {
    setError(null);
    if (!canRun || !preview) return;

    setUploading(true);
    setProgress({ done: 0, total: images.length });
    setFailures([]);

    try {
      const runRes = await fetch("/api/pilot/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: formatRunLabel(new Date()) }),
      });
      const runJson = await runRes.json();
      if (!runJson.ok) throw new Error(runJson.error ?? "Couldn't start the run.");
      const newRunId = runJson.run.id as string;
      setRunId(newRunId);

      // Reusing the exact rows already shown in the preview (not
      // re-parsing) — what she confirmed on screen is what gets submitted.
      const validRows = preview.rows as GroundTruthRow[];
      let nextIndex = 0;
      let doneCount = 0;

      async function worker() {
        while (nextIndex < images.length) {
          const index = nextIndex++;
          try {
            const normalized = await tryNormalizeImageForUpload(images[index]);

            const formData = new FormData();
            formData.append("image", normalized);
            formData.append("runId", newRunId);
            formData.append("scanOrder", String(index + 1));
            formData.append("groundTruth", JSON.stringify(validRows[index]));

            const res = await fetch("/api/pilot/compare-image", { method: "POST", body: formData });
            const json = await res.json();
            if (!json.ok) {
              setFailures((prev) => [...prev, { name: images[index].name, message: json.error ?? "Unknown error." }]);
            }
          } catch (err) {
            setFailures((prev) => [
              ...prev,
              { name: images[index].name, message: err instanceof Error ? err.message : "Something went wrong." },
            ]);
          }
          doneCount++;
          setProgress({ done: doneCount, total: images.length });
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setUploading(false);
    }
  }

  const finished = progress.total > 0 && progress.done === progress.total;

  if (uploading && !finished) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-foreground">
            Comparing {progress.done} of {progress.total}…
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>
    );
  }

  if (uploading && finished) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-medium text-foreground">
          {progress.total - failures.length} of {progress.total} compared
          {failures.length > 0 ? `, ${failures.length} failed` : ""}.
        </p>

        {failures.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {failures.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div>
                  <p className="font-medium text-foreground">{f.name}</p>
                  <p className="text-muted-foreground">{f.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {runId && (
          <Button className="mt-4" onClick={() => router.push(`/pilot/${runId}`)}>
            View results
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-foreground">Hand-graded test images or PDF</label>
        <input
          ref={imagesRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="mt-1.5 block text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {preparing && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            <span>
              Preparing &ldquo;{preparing.fileName}&rdquo; ({preparing.index} of {preparing.total})…
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Ground-truth CSV</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Columns: <code className="rounded bg-muted px-1 py-0.5">quiz_code</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">student_number</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">teacher_last_name</code>, then{" "}
          <code className="rounded bg-muted px-1 py-0.5">q1</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">q2</code>, … — one row per test, in the
          same order as the images above (row 1 = first image/page). Each row&apos;s quiz code
          determines how many <code className="rounded bg-muted px-1 py-0.5">qN</code> columns it
          needs, so a file can mix quizzes of different lengths.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1.5 block text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {(images.length > 0 || csvFile) && (
        <div>
          <p className="text-sm font-medium text-foreground">
            Pairing preview — confirm this matches before running
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Row 1 always pairs with image/page 1 in the order below. If you remove and re-add a
            file, it moves to the end of this list, not back to its original spot — check the
            order here before running.
          </p>

          {preview?.error && <p className="mt-2 text-sm text-red-600">{preview.error}</p>}

          {previewRowCount > 0 && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Image</th>
                    <th className="px-3 py-2 font-medium">CSV row</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: previewRowCount }, (_, i) => {
                    const file = images[i] as File | undefined;
                    const row = preview?.rows[i];
                    const rowError = preview?.rowErrors.find((e) => e.rowNumber === i + 1);
                    const hasCsvRow = preview !== null && i < preview.rows.length;
                    const ok = Boolean(file) && Boolean(row);

                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className={cn("px-3 py-1.5", file ? "text-foreground" : "text-destructive")}>
                          {file ? file.name : "missing image"}
                        </td>
                        <td className={cn("px-3 py-1.5", row ? "text-foreground" : "text-destructive")}>
                          {row
                            ? `${row.quizCode} / ${row.studentNumber}`
                            : rowError
                              ? rowError.message
                              : hasCsvRow
                                ? "invalid row"
                                : "missing CSV row"}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {ok ? (
                            <CheckCircle2 className="ml-auto size-4 text-primary" aria-hidden />
                          ) : (
                            <AlertTriangle className="ml-auto size-4 text-destructive" aria-hidden />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {images.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {images.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-foreground">
                    {i + 1}. {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button onClick={start} disabled={!canRun}>
          Run comparison
        </Button>
      </div>
    </div>
  );
}
