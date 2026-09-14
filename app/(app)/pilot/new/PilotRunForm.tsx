"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { parseGroundTruthCsv, type GroundTruthRow } from "@/lib/csv/groundTruthImport";
import { tryNormalizeImageForUpload } from "@/lib/media/normalizeImage";

const CONCURRENCY = 3;

function formatRunLabel(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Accuracy check — ${weekday} ${day}, ${time}`;
}

export function PilotRunForm() {
  const router = useRouter();
  const imagesRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<{ name: string; message: string }[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  async function start() {
    setError(null);

    if (images.length === 0) {
      setError("Choose the hand-graded test images.");
      return;
    }
    if (!csvFile) {
      setError("Choose the ground-truth CSV.");
      return;
    }

    const csvText = await csvFile.text();
    const { rows, error: parseError } = parseGroundTruthCsv(csvText);
    if (parseError) {
      setError(parseError);
      return;
    }
    if (rows.length !== images.length) {
      setError(
        `The CSV has ${rows.length} row${rows.length === 1 ? "" : "s"} but you chose ${images.length} image${images.length === 1 ? "" : "s"} — these need to match, one row per image, in the same order.`
      );
      return;
    }
    const badRow = rows.findIndex((r) => r === null);
    if (badRow !== -1) {
      setError(`Row ${badRow + 1} of the CSV is missing a field or has an invalid answer — fix it and try again.`);
      return;
    }

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

      const validRows = rows as GroundTruthRow[];
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
        <label className="text-sm font-medium text-foreground">Hand-graded test images</label>
        <input
          ref={imagesRef}
          type="file"
          accept="image/*"
          multiple
          className="mt-1.5 block text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          onChange={(e) => setImages(e.target.files ? Array.from(e.target.files) : [])}
        />
        {images.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{images.length} selected</p>
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
          same order as the images above (row 1 = first image).
        </p>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="mt-1.5 block text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button onClick={start}>Run comparison</Button>
      </div>
    </div>
  );
}
