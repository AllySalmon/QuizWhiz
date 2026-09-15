import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { readTestSheet } from "@/lib/anthropic/testSheetRead";
import { uploadScanImage } from "@/lib/supabase/storage";
import { getAnswerKeyByQuizCode } from "@/lib/db/queries/answerKeys";
import { getStudent } from "@/lib/db/queries/studentRoster";
import { getTeacher } from "@/lib/db/queries/teachers";
import { createTestRecord, maybeDeleteScanImage } from "@/lib/db/queries/testRecords";
import { scoreTest } from "@/lib/grading/scoreTest";
import { normalizeImageBuffer } from "@/lib/media/serverNormalize";
import { checkAndConsumeAiUsage } from "@/lib/grading/aiUsageCap";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The real per-test grading pipeline (Milestone 1b) — called once per image
 * by the client's upload loop (app/(app)/scan). One image, one request, one
 * self-contained result: store the scan, read it, score it, resolve it,
 * save it. Client-orchestrated on purpose (Docs/6-Implementation-Plan.md
 * plan for M1b) so a 200-image batch never risks a single long-running
 * serverless request timing out.
 *
 * Distinct from /api/grading/test-read, which stays as the M0 diagnostic
 * smoke test (no scoring, no DB writes).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  // Checked before any image work or the Claude call itself — a rejected
  // request never uploads a scan or spends a token (Docs/8-Pivot-Addendum.md
  // §9.3).
  const usage = await checkAndConsumeAiUsage();
  if (!usage.allowed) {
    return NextResponse.json({ ok: false, error: usage.message }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const file = form.get("image");
    const batchId = form.get("batchId");
    const scanOrderRaw = form.get("scanOrder");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing image." }, { status: 400 });
    }
    if (typeof batchId !== "string" || !batchId) {
      return NextResponse.json({ ok: false, error: "Missing batchId." }, { status: 400 });
    }
    const scanOrder = Number(scanOrderRaw);
    if (!Number.isInteger(scanOrder) || scanOrder < 1) {
      return NextResponse.json({ ok: false, error: "Missing scanOrder." }, { status: 400 });
    }

    // Always normalize to JPEG server-side, regardless of what the browser
    // sent — this is what actually has to work (TIFF from scanners, HEIC
    // from iPhones, whatever else), not something we can rely on the
    // client's format support for. See lib/media/serverNormalize.ts.
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
    const storagePath = `${batchId}/${scanOrder}-${randomUUID()}.jpg`;

    await uploadScanImage(storagePath, buffer, mediaType);

    const read = await readTestSheet({ imageBase64: buffer.toString("base64"), mediaType });

    const matchedKey = read.quizCode.value ? await getAnswerKeyByQuizCode(read.quizCode.value) : null;

    let rosterTeacherId: string | null = null;
    let rosterTeacherLastName: string | null = null;
    if (read.studentNumber.value) {
      const student = await getStudent(read.studentNumber.value.trim());
      if (student?.teacherId) {
        rosterTeacherId = student.teacherId;
        const teacher = await getTeacher(student.teacherId);
        rosterTeacherLastName = teacher?.lastName ?? null;
      }
    }

    const result = scoreTest({
      read,
      answerKeyQuestions: matchedKey?.questions.map((q) => ({
        questionNumber: q.questionNumber,
        correctAnswer: q.correctAnswer,
      })) ?? null,
      rosterTeacherId,
      rosterTeacherLastName,
    });

    // Atomic: the test record and its book report (if it failed) are
    // inserted together via a Postgres RPC — see create_graded_test_record
    // in supabase/test-records-functions.sql.
    const record = await createTestRecord({
      batchId,
      scanOrder,
      quizCode: read.quizCode.value,
      studentNumber: read.studentNumber.value,
      ocrTeacherLastName: read.teacherLastName.value,
      resolvedTeacherId: result.resolvedTeacherId,
      answersJson: Object.fromEntries(read.answers.map((a) => [String(a.questionNumber), a.selected])),
      scorePercent: result.scorePercent,
      passed: result.passed,
      gradingStatus: result.gradingStatus,
      assignmentStatus: result.assignmentStatus,
      flagReasons: result.flagReasons,
      scanImageRef: storagePath,
    });

    // If this test needed no review at all, its image is eligible for
    // deletion immediately — no need to wait for a review action.
    await maybeDeleteScanImage(record.id);

    return NextResponse.json({
      ok: true,
      testRecordId: record.id,
      gradingStatus: result.gradingStatus,
      assignmentStatus: result.assignmentStatus,
    });
  } catch (error) {
    console.error("process-image failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
