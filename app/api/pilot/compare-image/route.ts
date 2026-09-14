import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { readTestSheet } from "@/lib/anthropic/testSheetRead";
import { uploadScanImage } from "@/lib/supabase/storage";
import { getAnswerKeyByQuizCode } from "@/lib/db/queries/answerKeys";
import { createRunItem } from "@/lib/db/queries/comparisonRuns";
import { compareResult } from "@/lib/grading/compareResult";
import type { GroundTruthRow } from "@/lib/csv/groundTruthImport";
import { normalizeImageBuffer } from "@/lib/media/serverNormalize";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Milestone 1c: one test in an accuracy-pilot run. Reads the image with the
 * exact same production call (lib/anthropic/testSheetRead.ts), compares it
 * to the ground truth the librarian already entered for this row, and
 * persists the comparison. Never touches test_records, book_reports, or the
 * roster — entirely separate from real grading.
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
    const form = await request.formData();
    const file = form.get("image");
    const runId = form.get("runId");
    const scanOrderRaw = form.get("scanOrder");
    const groundTruthRaw = form.get("groundTruth");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing image." }, { status: 400 });
    }
    if (typeof runId !== "string" || !runId) {
      return NextResponse.json({ ok: false, error: "Missing runId." }, { status: 400 });
    }
    const scanOrder = Number(scanOrderRaw);
    if (!Number.isInteger(scanOrder) || scanOrder < 1) {
      return NextResponse.json({ ok: false, error: "Missing scanOrder." }, { status: 400 });
    }
    if (typeof groundTruthRaw !== "string") {
      return NextResponse.json({ ok: false, error: "Missing ground truth for this row." }, { status: 400 });
    }
    const groundTruth = JSON.parse(groundTruthRaw) as GroundTruthRow;

    // Always normalize to JPEG server-side — see lib/media/serverNormalize.ts.
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
    const mediaType = "image/jpeg" as const;
    const storagePath = `pilot/${runId}/${scanOrder}-${randomUUID()}.jpg`;
    await uploadScanImage(storagePath, buffer, mediaType);

    const read = await readTestSheet({ imageBase64: buffer.toString("base64"), mediaType });

    const [aiMatchedKey, groundTruthMatchedKey] = await Promise.all([
      read.quizCode.value ? getAnswerKeyByQuizCode(read.quizCode.value) : Promise.resolve(null),
      getAnswerKeyByQuizCode(groundTruth.quizCode),
    ]);

    const result = compareResult({
      read,
      groundTruth,
      aiMatchedKeyQuestions:
        aiMatchedKey?.questions.map((q) => ({ questionNumber: q.questionNumber, correctAnswer: q.correctAnswer })) ??
        null,
      groundTruthMatchedKeyQuestions:
        groundTruthMatchedKey?.questions.map((q) => ({
          questionNumber: q.questionNumber,
          correctAnswer: q.correctAnswer,
        })) ?? null,
    });

    const item = await createRunItem({
      runId,
      scanOrder,
      scanImageRef: storagePath,
      quizCode: groundTruth.quizCode,
      studentNumber: groundTruth.studentNumber,
      teacherLastName: groundTruth.teacherLastName,
      answersJson: Object.fromEntries(groundTruth.answers.map((a) => [String(a.questionNumber), a.circled])),
      aiQuizCode: read.quizCode.value,
      aiStudentNumber: read.studentNumber.value,
      aiTeacherLastName: read.teacherLastName.value,
      aiAnswersJson: Object.fromEntries(read.answers.map((a) => [String(a.questionNumber), a.selected])),
      ...result,
    });

    return NextResponse.json({ ok: true, itemId: item.id });
  } catch (error) {
    console.error("compare-image failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
