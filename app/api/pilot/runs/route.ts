import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRun } from "@/lib/db/queries/comparisonRuns";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { label } = await request.json();
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ ok: false, error: "Missing run label." }, { status: 400 });
  }

  const run = await createRun(label);
  return NextResponse.json({ ok: true, run });
}
