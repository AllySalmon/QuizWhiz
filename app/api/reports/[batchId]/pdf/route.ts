import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getBatch } from "@/lib/db/queries/batches";
import { getTeacherGroupedReport } from "@/lib/db/queries/testRecords";
import { ReportDocument } from "@/lib/reports/ReportDocument";

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
  // .ts, not .tsx — Next.js route handlers don't render JSX, so build the
  // element directly (ReportDocument itself lives in a .tsx file). The cast
  // works around @react-pdf/renderer's overly narrow renderToBuffer typing,
  // which expects literally a <Document> element rather than a component
  // that renders one.
  const element = createElement(ReportDocument, { batchLabel: batch.label, groups }) as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.label.replace(/[^\w\- ,]/g, "")}.pdf"`,
    },
  });
}
