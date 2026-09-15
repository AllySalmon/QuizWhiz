import Link from "next/link";
import { getStudentTestHistory } from "@/lib/db/queries/testRecords";
import { getStudent } from "@/lib/db/queries/studentRoster";
import { getTeacher } from "@/lib/db/queries/teachers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { DuplicateBadge } from "@/components/DuplicateBadge";

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

// The first entity-centric view in the app — everything tied to one
// student number, regardless of status. Deliberately not filtered like the
// Reports screen (exclude-and-link-back): a test stuck in review is still
// a real thing that happened to this student, so it belongs here, with a
// way to jump straight to resolving it.
export default async function StudentHistoryPage({
  params,
}: {
  params: Promise<{ studentNumber: string }>;
}) {
  const { studentNumber } = await params;

  const [student, records] = await Promise.all([
    getStudent(studentNumber),
    getStudentTestHistory(studentNumber),
  ]);

  const teacher = student?.teacherId ? await getTeacher(student.teacherId) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Student <span className="font-mono">{studentNumber}</span>
      </h1>

      {student ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {GRADE_BAND_LABEL[student.gradeBand]} —{" "}
          {teacher ? (
            <Link href={`/roster/teachers/${teacher.id}`} className="font-medium text-primary hover:underline">
              {teacher.firstName} {teacher.lastName}
            </Link>
          ) : (
            "no teacher assigned"
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not currently in the roster.</p>
      )}

      {records.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No tests on record for this student.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Book report</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground">{r.bookTitle ?? r.quizCode ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" })}
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
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge gradingStatus={r.gradingStatus} assignmentStatus={r.assignmentStatus} />
                      {r.isDuplicate && <DuplicateBadge />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.bookReportStatus === "outstanding" ? "Outstanding" : r.bookReportStatus === "received" ? "Received" : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      {r.gradingStatus === "needs_grading_review" && (
                        <Link href={`/review/grading/${r.id}`} className="text-sm font-medium text-primary hover:underline">
                          Resolve grading
                        </Link>
                      )}
                      {r.assignmentStatus === "needs_assignment_review" && (
                        <Link href={`/review/assignment/${r.id}`} className="text-sm font-medium text-primary hover:underline">
                          Resolve assignment
                        </Link>
                      )}
                      <Link href={`/batches/${r.batchId}`} className="text-sm text-muted-foreground hover:underline">
                        View batch
                      </Link>
                    </div>
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
