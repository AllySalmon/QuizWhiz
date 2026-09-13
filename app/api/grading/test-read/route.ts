import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readTestSheet } from "@/lib/anthropic/testSheetRead";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PLACEHOLDER_PATH = path.join(process.cwd(), "public", "sample-test-sheet-placeholder.png");

/**
 * Milestone 0 smoke-test route.
 *
 * Purpose: prove the pipeline (auth -> image -> Claude -> structured JSON)
 * works end to end, per Docs/6-Implementation-Plan.md §2 exit criteria.
 * This is NOT the real grading endpoint and does NOT score against an
 * answer key — that's Milestone 1 scope.
 *
 * Accepts an optional multipart "image" field; falls back to a bundled
 * placeholder (a blank 1x1 PNG, not a real test sheet) when none is given.
 * With the placeholder, expect every field to come back null/low-confidence
 * — that's a correct result for this smoke test, not a bug. Swap in a real
 * scanned sheet (via the "image" field, or by replacing the placeholder
 * file) once one is available to actually exercise the read quality.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  try {
    let imageBase64: string;
    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/png";
    let usedPlaceholder = true;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image");
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageBase64 = buffer.toString("base64");
        mediaType = (file.type as typeof mediaType) || "image/png";
        usedPlaceholder = false;
      } else {
        imageBase64 = (await readFile(PLACEHOLDER_PATH)).toString("base64");
      }
    } else {
      imageBase64 = (await readFile(PLACEHOLDER_PATH)).toString("base64");
    }

    const result = await readTestSheet({ imageBase64, mediaType });

    return NextResponse.json({ ok: true, usedPlaceholder, data: result });
  } catch (error) {
    console.error("test-read smoke test failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
