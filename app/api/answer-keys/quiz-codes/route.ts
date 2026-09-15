import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listQuizCodeQuestionCounts } from "@/lib/db/queries/answerKeys";

export const runtime = "nodejs";

// Lets the accuracy pilot (PilotRunForm.tsx) validate its ground-truth CSV
// against each row's real quiz code + question count, instead of guessing
// question count from the CSV's own header (lib/csv/groundTruthImport.ts).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const quizCodes = await listQuizCodeQuestionCounts();
  return NextResponse.json({ ok: true, quizCodes });
}
