import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch } from "@/lib/db/queries/batches";
import { countsForBatch, listTestRecordsForBatch } from "@/lib/db/queries/testRecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BatchTestRecordsTable } from "./BatchTestRecordsTable";

export default async function BatchSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, counts, records] = await Promise.all([
    getBatch(id),
    countsForBatch(id),
    listTestRecordsForBatch(id),
  ]);
  if (!batch) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{batch.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{counts.total} tests graded</p>
        </div>
        <Link href={`/batches/${id}/delete`} className="text-sm font-medium text-destructive hover:underline">
          Delete batch
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 sm:max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Clean</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-foreground">{counts.clean}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Grading Review</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-foreground">{counts.gradingReview}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-foreground">{counts.assignmentReview}</span>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          disabled={counts.gradingReview === 0}
          render={<Link href={`/review/grading?batch=${id}`}>Open Grading Review</Link>}
        />
        <Button
          variant="outline"
          disabled={counts.assignmentReview === 0}
          render={<Link href={`/review/assignment?batch=${id}`}>Open Needs Review</Link>}
        />
      </div>

      {records.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No tests in this batch yet.</p>
      ) : (
        <div className="mt-8">
          <BatchTestRecordsTable batchId={id} records={records} />
        </div>
      )}
    </div>
  );
}
