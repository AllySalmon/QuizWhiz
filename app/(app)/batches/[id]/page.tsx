import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch } from "@/lib/db/queries/batches";
import { countsForBatch, listTestRecordsForBatch } from "@/lib/db/queries/testRecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTestRecordsTable } from "./BatchTestRecordsTable";

export default async function BatchSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;
  const [batch, counts, allRecords] = await Promise.all([
    getBatch(id),
    countsForBatch(id),
    listTestRecordsForBatch(id),
  ]);
  if (!batch) notFound();

  // Same "clean" definition countsForBatch already uses — filtering here
  // (in-memory, over the batch's already-fetched records) rather than a
  // separate query, since a batch's record count is small.
  const showingCleanOnly = status === "clean";
  const records = showingCleanOnly
    ? allRecords.filter(
        (r) => r.gradingStatus !== "needs_grading_review" && r.assignmentStatus !== "needs_assignment_review"
      )
    : allRecords;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{batch.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{counts.total} tests graded</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/batches/${id}/report`} className="text-sm font-medium text-primary hover:underline">
            Generate Report
          </Link>
          <Link href={`/batches/${id}/delete`} className="text-sm font-medium text-destructive hover:underline">
            Delete batch
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 sm:max-w-lg">
        <BatchStatCard label="Clean" value={counts.clean} href={`/batches/${id}?status=clean`} />
        <BatchStatCard
          label="Grading Review"
          value={counts.gradingReview}
          href={counts.gradingReview > 0 ? `/review/grading?batch=${id}` : undefined}
        />
        <BatchStatCard
          label="Needs Review"
          value={counts.assignmentReview}
          href={counts.assignmentReview > 0 ? `/review/assignment?batch=${id}` : undefined}
        />
      </div>

      {showingCleanOnly && (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing clean records only —{" "}
          <Link href={`/batches/${id}`} className="font-medium text-primary hover:underline">
            view all
          </Link>
          .
        </p>
      )}

      {records.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {showingCleanOnly ? "No clean records in this batch." : "No tests in this batch yet."}
        </p>
      ) : (
        <div className="mt-8">
          <BatchTestRecordsTable batchId={id} records={records} />
        </div>
      )}
    </div>
  );
}

// The card itself is the "Open Grading Review"/"Open Needs Review"/filter
// action — no separate button underneath duplicating the same destination.
// Only clickable when it actually leads somewhere (same href-optional
// pattern as StatCard on the Home dashboard, app/(app)/page.tsx). Hover
// treatment matches the header nav's blue + "pop" (app/(app)/layout.tsx).
function BatchStatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const card = (
    <Card
      className={
        href
          ? "transition-all duration-150 hover:-translate-y-1 hover:scale-105 hover:border-primary/40 hover:shadow-md"
          : undefined
      }
    >
      <CardHeader>
        <CardTitle
          className={
            href
              ? "text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary"
              : "text-sm font-medium text-muted-foreground"
          }
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={
            href
              ? "text-2xl font-semibold text-foreground transition-colors group-hover:text-primary"
              : "text-2xl font-semibold text-foreground"
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="group block">
      {card}
    </Link>
  ) : (
    card
  );
}
