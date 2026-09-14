"use client";

import { useState } from "react";

type Result =
  | { ok: true; usedPlaceholder: boolean; data: unknown }
  | { ok: false; error: string };

export function SmokeTestPanel() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);

  async function runSmokeTest() {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/grading/test-read", { method: "POST" });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Milestone 0 smoke test</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Sends a placeholder image to Claude and confirms a structured response comes back. This
        checks the pipeline, not read accuracy — expect null/low-confidence fields until a real
        scanned sheet replaces the placeholder.
      </p>

      <button
        onClick={runSmokeTest}
        disabled={pending}
        className="mt-4 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Calling Claude…" : "Run smoke test"}
      </button>

      {result && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-zinc-50 p-4 text-xs text-zinc-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
