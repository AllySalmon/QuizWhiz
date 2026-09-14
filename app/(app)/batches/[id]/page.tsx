import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch } from "@/lib/db/queries/batches";
import { countsForBatch, listTestRecordsForBatch } from "@/lib/db/queries/testRecords";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{batch.label}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{counts.total} tests graded</p>

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
        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Book</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.scanOrder}</TableCell>
                  <TableCell className="text-foreground">{r.bookTitle ?? r.quizCode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{r.studentNumber ?? "—"}</TableCell>
                  <TableCell>
                    {r.resolvedTeacherFirstName ? `${r.resolvedTeacherFirstName} ${r.resolvedTeacherLastName}` : "—"}
                  </TableCell>
                  <TableCell>
                    {r.scorePercent !== null ? (
                      <span className={r.passed ? "text-foreground" : "font-medium text-destructive"}>
                        {Number(r.scorePercent).toFixed(0)}% {r.passed ? "" : "(fail)"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge gradingStatus={r.gradingStatus} assignmentStatus={r.assignmentStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  gradingStatus,
  assignmentStatus,
}: {
  gradingStatus: "clean" | "needs_grading_review" | "resolved";
  assignmentStatus: "clean" | "needs_assignment_review" | "resolved";
}) {
  if (gradingStatus === "needs_grading_review") {
    return <span className="text-sm text-destructive">Needs grading review</span>;
  }
  if (assignmentStatus === "needs_assignment_review") {
    return <span className="text-sm text-destructive">Needs assignment review</span>;
  }
  const wasReviewed = gradingStatus === "resolved" || assignmentStatus === "resolved";
  return <span className="text-sm text-muted-foreground">{wasReviewed ? "Resolved" : "Clean"}</span>;
}
