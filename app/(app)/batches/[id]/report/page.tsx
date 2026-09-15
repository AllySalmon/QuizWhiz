import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch } from "@/lib/db/queries/batches";
import { getTeacherGroupedReport, countsForBatch } from "@/lib/db/queries/testRecords";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function BatchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, groups, counts] = await Promise.all([getBatch(id), getTeacherGroupedReport(id), countsForBatch(id)]);
  if (!batch) notFound();

  const excludedCount = counts.gradingReview + counts.assignmentReview;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{batch.label} — Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">Grouped by teacher, sorted by scan order.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href={`/api/reports/${id}/xlsx`}>Export Spreadsheet</a>} />
          <Button variant="outline" render={<a href={`/api/reports/${id}/pdf`}>Export PDF</a>} />
        </div>
      </div>

      {excludedCount > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {excludedCount} test{excludedCount === 1 ? " is" : "s are"} still in review and left out of this
          report —{" "}
          <Link href={`/batches/${id}`} className="font-medium text-primary hover:underline">
            resolve them first
          </Link>{" "}
          to include them.
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing resolved in this batch yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {groups.map((group) => (
            <div key={group.teacherId}>
              <h2 className="text-sm font-semibold text-foreground">
                {group.teacherFirstName} {group.teacherLastName}
              </h2>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student #</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Date Tested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.studentNumber ?? "—"}</TableCell>
                        <TableCell className="text-foreground">{row.bookTitle ?? row.quizCode ?? "—"}</TableCell>
                        <TableCell>
                          {row.scorePercent !== null ? `${Number(row.scorePercent).toFixed(0)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {row.passed === null ? (
                            "—"
                          ) : (
                            <span className={row.passed ? "text-foreground" : "font-medium text-destructive"}>
                              {row.passed ? "Pass" : "Fail"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.createdAt.toISOString().slice(0, 10)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
