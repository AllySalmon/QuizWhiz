import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBatch } from "@/lib/db/queries/batches";
import { getTeacherGroupedReport } from "@/lib/db/queries/testRecords";
import { buildReportWorkbook } from "@/lib/reports/buildWorkbook";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { batchId } = await params;
  const batch = await getBatch(batchId);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const groups = await getTeacherGroupedReport(batchId);
  const buffer = buildReportWorkbook(batch.label, groups);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${batch.label.replace(/[^\w\- ,]/g, "")}.xlsx"`,
    },
  });
}
