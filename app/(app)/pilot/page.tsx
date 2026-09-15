import Link from "next/link";
import { listRuns } from "@/lib/db/queries/comparisonRuns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PilotPage() {
  const runs = await listRuns();

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Accuracy Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare the AI&apos;s reads against tests you&apos;ve already hand-graded. Separate from
            real grading — nothing here touches scores, review queues, or the roster.
          </p>
        </div>
        <Button className="shrink-0" render={<Link href="/pilot/new">New Run</Link>} />
      </div>

      {runs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No accuracy checks run yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-foreground">{run.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/pilot/${run.id}`} className="text-sm font-medium text-primary hover:underline">
                      View Results
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
