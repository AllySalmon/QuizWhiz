import Link from "next/link";
import { listAssignmentReviewQueue } from "@/lib/db/queries/testRecords";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DuplicateBadge } from "@/components/DuplicateBadge";
import { ReviewTabs } from "../ReviewTabs";

export default async function AssignmentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { batch } = await searchParams;
  const items = await listAssignmentReviewQueue(batch);

  return (
    <div>
      <ReviewTabs active="assignment" batchId={batch} />

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Needs Review (Assignment)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The student number, quiz code, or teacher name couldn&apos;t be confidently resolved. The score is
          already saved — this only affects which teacher&apos;s report it lands in.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">All tests are assigned to a teacher.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>OCR&apos;d teacher</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-foreground">{item.bookTitle ?? item.quizCode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.studentNumber ? (
                      <Link href={`/students/${item.studentNumber}`} className="hover:underline">
                        {item.studentNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{item.ocrTeacherLastName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      <span>{describeFlags(item.flagReasons as string[])}</span>
                      {item.isDuplicate && <DuplicateBadge />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/review/assignment/${item.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/batches/${item.batchId}/${item.id}/delete`}
                        className="text-sm font-medium text-destructive hover:underline"
                      >
                        Delete
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

function describeFlags(flags: string[]) {
  if (flags.includes("unreadable_student_number")) return "Student number unreadable";
  if (flags.includes("student_not_in_roster")) return "Not in roster";
  if (flags.includes("teacher_title_detected")) return "Title/honorific written for teacher";
  if (flags.includes("roster_mismatch")) return "Teacher doesn't match roster";
  return "Needs review";
}
