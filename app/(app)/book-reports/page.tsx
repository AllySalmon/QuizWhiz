import { AlertTriangle } from "lucide-react";
import { listOutstandingGroupedByTeacher } from "@/lib/db/queries/bookReports";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { markReceivedAction } from "./actions";

// Docs/1-PRD.md §5.7 / Docs/2-App-Flow.md §4.8: outstanding book reports,
// grouped by the teacher who needs to follow up, oldest/escalated first
// within each group (lib/db/queries/bookReports.ts).
export default async function BookReportsPage() {
  const reports = await listOutstandingGroupedByTeacher();

  const groups = new Map<string, { label: string; rows: typeof reports }>();
  for (const report of reports) {
    const key = report.teacherId ?? "unassigned";
    const label = report.teacherId
      ? `${report.teacherFirstName} ${report.teacherLastName}`
      : "No teacher assigned";
    if (!groups.has(key)) groups.set(key, { label, rows: [] });
    groups.get(key)!.rows.push(report);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Book Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Outstanding book reports, grouped by teacher. A report is created automatically whenever a
        test comes back failing.
      </p>

      {groups.size === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing outstanding.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {[...groups.values()].map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student #</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Days outstanding</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((report) => {
                      const daysOutstanding = Math.floor(
                        (Date.now() - new Date(report.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <TableRow key={report.id}>
                          <TableCell className="font-mono text-sm">{report.studentNumber}</TableCell>
                          <TableCell className="text-foreground">{report.bookTitle ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            <span className="flex items-center gap-1.5">
                              {report.isEscalated && (
                                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                                  <AlertTriangle className="size-3.5" aria-hidden />
                                  Escalated
                                </span>
                              )}
                              <span className={report.isEscalated ? "text-destructive" : "text-muted-foreground"}>
                                {daysOutstanding} day{daysOutstanding === 1 ? "" : "s"}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <form action={markReceivedAction.bind(null, report.id)}>
                              <Button type="submit" variant="outline" size="sm">
                                Mark Received
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
