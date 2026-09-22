import Link from "next/link";
import { notFound } from "next/navigation";
import { getTestRecord, getTestRecordScanImageUrl } from "@/lib/db/queries/testRecords";
import { getAnswerKeyByQuizCode } from "@/lib/db/queries/answerKeys";
import { StatusBadge } from "@/components/StatusBadge";

// The general-purpose "view what was scanned" page — unlike the two Review
// screens (app/(app)/review/grading/[id]/page.tsx, .../assignment/[id]/page.tsx),
// this works for any test record regardless of status, and is what actually
// exists for the grace-period window described in
// lib/db/queries/scanImageRetention.ts. Same batchId ownership guard as
// .../[recordId]/delete/page.tsx.
export default async function ViewScanPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  const record = await getTestRecord(recordId);
  if (!record || record.batchId !== id) notFound();

  const [imageUrl, matchedKey] = await Promise.all([
    getTestRecordScanImageUrl(recordId),
    record.quizCode ? getAnswerKeyByQuizCode(record.quizCode) : null,
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {matchedKey?.bookTitle ?? record.quizCode ?? "Scan"}
        </h1>
        <Link href={`/batches/${id}`} className="text-sm font-medium text-primary hover:underline">
          Back to batch
        </Link>
      </div>

      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Student <span className="font-mono">{record.studentNumber ?? "(unreadable)"}</span>
        </span>
        {record.scorePercent !== null && (
          <span className={record.passed ? undefined : "font-medium text-destructive"}>
            — {Number(record.scorePercent).toFixed(0)}% {record.passed ? "" : "(fail)"}
          </span>
        )}
        <StatusBadge gradingStatus={record.gradingStatus} assignmentStatus={record.assignmentStatus} />
      </div>

      <div className="mt-4 max-w-xl rounded-xl border border-border bg-card p-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Scanned test sheet" className="w-full rounded-lg" />
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Scan image no longer available — images are kept for about a day after grading, then removed.
          </p>
        )}
      </div>
    </div>
  );
}
