"use client";

import * as pdfjsLib from "pdfjs-dist";

// Next.js/Turbopack-friendly worker resolution — the officially recommended
// pattern for pdfjs-dist (see its README): resolves to a static asset URL
// at build time, no manual copy into public/ needed.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const TARGET_LONG_EDGE = 2000; // matches lib/media/normalizeImage.ts's maxDimension —
// that's the resolution the AI vision call is already tuned against.

// Client-only PDF -> per-page JPEG File[] splitter (Docs/3-Tech-Stack.md §3:
// "Each page/photo is split into an individual test image"). Runs entirely
// in the browser so a large multi-page scan never becomes one big,
// timeout-risking server request — every page just becomes a plain File,
// indistinguishable from a phone photo to the rest of the upload pipeline.
export async function pdfFileToPageImages(file: File): Promise<File[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch {
    throw new Error(`Couldn't read "${file.name}" — it may be corrupted or password-protected.`);
  }

  const baseName = file.name.replace(/\.[^./\\]+$/, "");
  const pages: File[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = TARGET_LONG_EDGE / Math.max(baseViewport.width, baseViewport.height);
      const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering isn't supported in this browser.");

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) throw new Error(`Couldn't render page ${pageNumber} of "${file.name}".`);

      pages.push(new File([blob], `${baseName}-p${pageNumber}.jpg`, { type: "image/jpeg" }));
    }
  } finally {
    await loadingTask.destroy();
  }

  if (pages.length === 0) {
    throw new Error(`"${file.name}" has no pages.`);
  }

  return pages;
}
