import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { listGradingReviewQueue } from "@/lib/db/queries/testRecords";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReviewTabs } from "../ReviewTabs";

export default async function GradingReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { batch } = await searchParams;
  const items = await listGradingReviewQueue(batch);

  return (
    <div>
      <ReviewTabs active="grading" batchId={batch} />

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Grading Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The answer marks themselves were unclear — confirm or correct what&apos;s actually circled.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing to review — every mark was read clearly.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-foreground">{item.bookTitle ?? item.quizCode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{item.studentNumber ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      {item.isEscalated && (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          Escalated
                        </span>
                      )}
                      {describeFlags(item.flagReasons as string[])}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/review/grading/${item.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Review
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

function describeFlags(flags: string[]) {
  if (flags.includes("unrecognized_quiz_code")) return "Quiz code not recognized";
  const unclear = flags.filter((f) => f.startsWith("unclear_answer_q"));
  if (unclear.length > 0) return `${unclear.length} unclear answer${unclear.length > 1 ? "s" : ""}`;
  return "Needs review";
}
