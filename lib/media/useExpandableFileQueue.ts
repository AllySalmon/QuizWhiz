"use client";

import { useRef, useState } from "react";
import { pdfFileToPageImages } from "./pdfToImages";

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export type PreparingState = { fileName: string; index: number; total: number } | null;

// Shared by app/(app)/scan/ScanUploadForm.tsx and app/(app)/pilot/new/PilotRunForm.tsx
// so PDF support only has to be written once — these were two independent
// implementations that already drifted once (Milestone 2's PDF work only
// touched Scan & Upload, leaving the pilot uploading raw PDF bytes straight
// to the AI-read endpoint). A picked PDF is expanded into one JPEG File per
// page at selection time (via lib/media/pdfToImages.ts); after this hook
// runs, every entry in `files` is a plain image File, indistinguishable
// from a phone photo to whatever uploads it next.
export function useExpandableFileQueue() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [hasPdfSource, setHasPdfSource] = useState(false);
  const [preparing, setPreparing] = useState<PreparingState>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const picked = Array.from(fileList);
    if (inputRef.current) inputRef.current.value = "";

    setError(null);
    const expanded: File[] = [];

    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      if (!isPdf(file)) {
        expanded.push(file);
        continue;
      }

      setHasPdfSource(true);
      setPreparing({ fileName: file.name, index: i + 1, total: picked.length });
      try {
        const pages = await pdfFileToPageImages(file);
        expanded.push(...pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Couldn't read "${file.name}".`);
      }
    }

    setPreparing(null);
    setFiles((prev) => [...prev, ...expanded]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setFiles([]);
    setHasPdfSource(false);
    setError(null);
    setPreparing(null);
  }

  return {
    inputRef,
    files,
    setFiles,
    hasPdfSource,
    preparing,
    error,
    setError,
    handleFilesSelected,
    removeFile,
    reset,
  };
}
