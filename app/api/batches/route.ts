import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBatch } from "@/lib/db/queries/batches";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { label, itemCount, sourceType } = body;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ ok: false, error: "Missing batch label." }, { status: 400 });
  }
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    return NextResponse.json({ ok: false, error: "Missing item count." }, { status: 400 });
  }
  if (sourceType !== "photo" && sourceType !== "pdf") {
    return NextResponse.json({ ok: false, error: "Missing or invalid sourceType." }, { status: 400 });
  }

  const batch = await createBatch({ label, sourceType, itemCount });
  return NextResponse.json({ ok: true, batch });
}
