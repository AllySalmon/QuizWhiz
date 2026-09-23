"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tryNormalizeImageForUpload } from "@/lib/media/normalizeImage";
import { useExpandableFileQueue } from "@/lib/media/useExpandableFileQueue";
import type { AnswerKeySheetRead } from "@/lib/anthropic/answerKeySheetRead";

export type ScannedAnswerKey = {
  quizCode: string;
  bookTitle: string;
  gradeBand?: "jr" | "3-5";
  questionCount: number;
  questions: { questionNumber: number; correctAnswer: "A" | "B" | "C" | "D" }[];
  lowConfidenceCount: number;
};

function mapRead(read: AnswerKeySheetRead): ScannedAnswerKey {
  const questions = read.answers
    .filter((a) => a.correctAnswer !== null && a.confidence === "high")
    .map((a) => ({ questionNumber: a.questionNumber, correctAnswer: a.correctAnswer as "A" | "B" | "C" | "D" }));

  return {
    quizCode: read.quizCode.confidence === "high" ? (read.quizCode.value ?? "") : "",
    bookTitle: read.bookTitle.confidence === "high" ? (read.bookTitle.value ?? "") : "",
    gradeBand: read.gradeBand.confidence === "high" ? (read.gradeBand.value ?? undefined) : undefined,
    questionCount: read.answers.length || 5,
    questions,
    lowConfidenceCount: read.answers.length - questions.length,
  };
}

// Single-document counterpart to app/(app)/scan/ScanUploadForm.tsx — reads
// one answer key sheet instead of a batch of student tests, and proposes
// prefilled form values instead of writing anything to the DB (see
// app/api/answer-keys/read-scan/route.ts). Reuses the same PDF-expansion
// hook that flow already shares with Pilot, so a copier/scanner PDF works
// here too without a second implementation of that.
export function ScanAnswerKeyUpload({ onRead }: { onRead: (scanned: ScannedAnswerKey) => void }) {
  const { inputRef, files, preparing, error, setError, handleFilesSelected, reset } = useExpandableFileQueue();
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function readSheet() {
    if (files.length === 0) return;
    setError(null);
    setNotice(null);
    setReading(true);

    try {
      const normalized = await tryNormalizeImageForUpload(files[0]);

      // Catches a bad conversion client-side (e.g. a PDF page that rendered
      // to an empty/corrupt canvas) with a clear, specific message, instead
      // of sending it to the server to fail with sharp's generic "not a
      // recognizable image" error — which fires for any unparseable buffer,
      // not just a literal non-image file, so it doesn't actually say what
      // went wrong.
      try {
        const probe = await createImageBitmap(normalized);
        probe.close();
      } catch {
        throw new Error(
          files.length > 1 || files[0].name.includes("-p1.")
            ? `That PDF page didn't convert to a readable image. Try a different page, or a plain photo of the sheet instead.`
            : `"${files[0].name}" isn't a readable image. Try a different file or a plain photo of the sheet instead.`
        );
      }

      const formData = new FormData();
      formData.append("image", normalized);

      const res = await fetch("/api/answer-keys/read-scan", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Couldn't read that sheet.");

      const scanned = mapRead(json.read as AnswerKeySheetRead);
      onRead(scanned);

      const pageNote = files.length > 1 ? "This file had multiple pages — using page 1. " : "";
      setNotice(
        scanned.lowConfidenceCount > 0
          ? `${pageNote}${scanned.lowConfidenceCount} answer${scanned.lowConfidenceCount === 1 ? "" : "s"} weren't clearly readable — confirm them below.`
          : `${pageNote}Prefilled below — double-check it, then save.`
      );
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Scan or upload an answer key sheet</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A photo, scan, or PDF of the answer key — AI reads it and fills in the form below for you to check.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="answer-key-scan-file"
          type="file"
          accept="image/*,application/pdf"
          className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <Button type="button" onClick={readSheet} disabled={files.length === 0 || reading}>
          {reading ? "Reading…" : "Read answer key"}
        </Button>
      </div>

      {preparing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          <span>Preparing &ldquo;{preparing.fileName}&rdquo;…</span>
        </div>
      )}

      {/* The native input's own display can't be relied on — handleFilesSelected
          resets its value immediately (so the same file can be re-picked
          later), so without this the file input looks empty right after a
          selection even though `files` state holds it. Shows the post-PDF-
          expansion filename(s) on purpose — confirms conversion actually
          happened, not just what was originally picked. */}
      {!preparing && files.length > 0 && (
        <p className="mt-3 text-sm text-foreground">
          Selected: <span className="font-medium">{files.map((f) => f.name).join(", ")}</span>
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {notice && <p className="mt-3 text-sm text-foreground">{notice}</p>}
    </div>
  );
}
