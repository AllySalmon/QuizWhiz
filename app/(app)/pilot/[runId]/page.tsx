import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun, listRunItems, getRunStats } from "@/lib/db/queries/comparisonRuns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default async function PilotRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [run, items, stats] = await Promise.all([getRun(runId), listRunItems(runId), getRunStats(runId)]);
  if (!run) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{run.label}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{stats.total} tests compared</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Quiz code accuracy" value={pct(stats.quizCodeAccuracy)} />
        <StatCard label="Student number accuracy" value={pct(stats.studentNumberAccuracy)} />
        <StatCard label="Teacher name accuracy" value={pct(stats.teacherNameAccuracy)} />
        <StatCard label="Answer read accuracy" value={pct(stats.answerAccuracy)} />
        <StatCard label="Score match rate" value={pct(stats.scoreMatchRate)} />
        <StatCard
          label="False clean rate"
          value={pct(stats.falseCleanRate)}
          detail={`${stats.falseCleanCount} of ${stats.total}`}
          warn={stats.falseCleanCount > 0}
        />
      </div>

      {stats.falseCleanCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          {stats.falseCleanCount} test{stats.falseCleanCount === 1 ? "" : "s"} would have graded
          silently (no review flag) but the score was actually wrong — the number that matters
          most before trusting this on real scores.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student #</TableHead>
              <TableHead>Quiz code</TableHead>
              <TableHead>Score match</TableHead>
              <TableHead>Would&apos;ve been clean</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.studentNumber}</TableCell>
                <TableCell className="font-mono text-sm">{item.quizCode}</TableCell>
                <TableCell>
                  {item.scoreMatch ? (
                    <CheckCircle2 className="size-4 text-primary" aria-label="matched" />
                  ) : (
                    <XCircle className="size-4 text-destructive" aria-label="mismatched" />
                  )}
                </TableCell>
                <TableCell>
                  {item.falseClean ? (
                    <span className="text-xs font-medium text-destructive">false clean</span>
                  ) : item.wouldHaveBeenClean ? (
                    "yes"
                  ) : (
                    "no — flagged"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/pilot/${runId}/${item.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Details
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function pct(n: number) {
  return `${n.toFixed(0)}%`;
}

function StatCard({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className={warn ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold text-foreground"}>
          {value}
        </span>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
