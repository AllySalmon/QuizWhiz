import Link from "next/link";
import { listGradedToday } from "@/lib/db/queries/testRecords";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function GradedTodayPage() {
  const records = await listGradedToday();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Graded Today</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every test scanned since midnight, across all batches. To delete a scan, open its batch from
        Scan History.
      </p>

      {records.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing graded yet today.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Batch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
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
                  <TableCell className="text-right">
                    <Link href={`/batches/${r.batchId}`} className="text-sm font-medium text-primary hover:underline">
                      View batch
                    </Link>
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
