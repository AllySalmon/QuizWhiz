"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

const CONCURRENCY = 3;

type ItemStatus = "queued" | "uploading" | "done" | "failed";

type QueueItem = {
  file: File;
  scanOrder: number;
  status: ItemStatus;
};

function formatBatchLabel(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${weekday} ${day}, ${time}`;
}

export function ScanUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    setFiles((prev) => [...prev, ...Array.from(fileList)]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function startUpload() {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);

    const queue: QueueItem[] = files.map((file, i) => ({ file, scanOrder: i + 1, status: "queued" }));
    setItems(queue);

    try {
      const batchRes = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: formatBatchLabel(new Date()), itemCount: files.length }),
      });
      const batchJson = await batchRes.json();
      if (!batchJson.ok) throw new Error(batchJson.error ?? "Couldn't start the batch.");
      const batchId = batchJson.batch.id as string;

      let nextIndex = 0;
      async function worker() {
        while (nextIndex < queue.length) {
          const index = nextIndex++;
          const item = queue[index];
          setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: "uploading" } : it)));

          const formData = new FormData();
          formData.append("image", item.file);
          formData.append("batchId", batchId);
          formData.append("scanOrder", String(item.scanOrder));

          try {
            const res = await fetch("/api/grading/process-image", { method: "POST", body: formData });
            const json = await res.json();
            setItems((prev) =>
              prev.map((it, i) => (i === index ? { ...it, status: json.ok ? "done" : "failed" } : it))
            );
          } catch {
            setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: "failed" } : it)));
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      router.push(`/batches/${batchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setUploading(false);
    }
  }

  const doneCount = items.filter((i) => i.status === "done" || i.status === "failed").length;

  if (uploading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-foreground">
            Grading {doneCount} of {items.length}…
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          This can take a few minutes for a large batch — feel free to leave this tab open in the
          background.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="scan-files"
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-10 text-center hover:border-primary/40"
      >
        <span className="text-sm font-medium text-foreground">Choose photos or scanned images</span>
        <span className="mt-1 text-xs text-muted-foreground">JPG or PNG, any number of pages</span>
        <input
          ref={inputRef}
          id="scan-files"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">{files.length} in this batch</p>
          <ul className="mt-2 flex flex-col gap-1">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <span className="truncate text-foreground">{file.name}</span>
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

          <Button className="mt-4" onClick={startUpload}>
            Upload &amp; Grade
          </Button>
        </div>
      )}
    </div>
  );
}
