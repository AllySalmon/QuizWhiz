import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAnswerKeySheet } from "@/lib/anthropic/answerKeySheetRead";
import { normalizeImageBuffer } from "@/lib/media/serverNormalize";
import { checkAndConsumeAiUsage } from "@/lib/grading/aiUsageCap";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reads one answer key sheet (image or a single expanded PDF page from
 * app/(app)/answer-keys/ScanAnswerKeyUpload.tsx) and returns the structured
 * read directly — no DB or storage write here. This is purely a "propose"
 * step: the librarian reviews/corrects the prefilled form and the existing
 * createAnswerKeyAction (app/(app)/answer-keys/actions.ts) does the actual
 * save, same as manual entry. Distinct from /api/grading/process-image,
 * which both reads AND persists a graded student test record.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Same shared cap Scan & Upload uses (lib/grading/aiUsageCap.ts) — already
  // a no-op outside demo mode.
  const usage = await checkAndConsumeAiUsage();
  if (!usage.allowed) {
    return NextResponse.json({ ok: false, error: usage.message }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing image." }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    let buffer: Buffer;
    try {
      buffer = await normalizeImageBuffer(rawBuffer);
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : `Couldn't read "${file.name}".` },
        { status: 400 }
      );
    }

    const read = await readAnswerKeySheet({ imageBase64: buffer.toString("base64"), mediaType: "image/jpeg" });

    return NextResponse.json({ ok: true, read });
  } catch (error) {
    console.error("read-scan (answer key) failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
