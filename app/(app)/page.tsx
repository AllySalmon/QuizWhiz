import Link from "next/link";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { answerKeysExist } from "@/lib/db/queries/answerKeys";
import { teachersExist } from "@/lib/db/queries/teachers";
import { studentRosterExists } from "@/lib/db/queries/studentRoster";
import { dashboardCounts, countEscalatedGradingReview } from "@/lib/db/queries/testRecords";
import { countOutstandingBookReports } from "@/lib/db/queries/bookReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Docs/1-PRD.md §5.9 / Docs/2-App-Flow.md §2: the Home dashboard's primary
// action is a guided setup checklist until Answer Keys, Teachers, and the
// Student Roster all have at least one record — then it switches to the
// normal day-to-day dashboard. State is derived directly from existence
// checks (Docs/5-Backend-Schema.md §4), no separate "setup complete" flag.
export default async function Home() {
  const [hasAnswerKeys, hasTeachers, hasStudents] = await Promise.all([
    answerKeysExist(),
    teachersExist(),
    studentRosterExists(),
  ]);

  const setupComplete = hasAnswerKeys && hasTeachers && hasStudents;

  if (!setupComplete) {
    return (
      <SetupChecklist
        hasAnswerKeys={hasAnswerKeys}
        hasTeachers={hasTeachers}
        hasStudents={hasStudents}
      />
    );
  }

  return <Dashboard />;
}

function SetupChecklist({
  hasAnswerKeys,
  hasTeachers,
  hasStudents,
}: {
  hasAnswerKeys: boolean;
  hasTeachers: boolean;
  hasStudents: boolean;
}) {
  const items = [
    { done: hasAnswerKeys, label: "Add Answer Keys", href: "/answer-keys/new" },
    { done: hasTeachers, label: "Add Teachers", href: "/roster/teachers" },
    { done: hasStudents, label: "Import Students", href: "/roster/students" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const nextItem = items.find((i) => !i.done);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Let&apos;s get set up</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {doneCount} of {items.length} set up
        {nextItem ? ` — ${nextItem.label.toLowerCase()} to finish` : ""}.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
          >
            {item.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span
              className={
                item.done
                  ? "text-sm font-medium text-muted-foreground line-through"
                  : "text-sm font-medium text-foreground"
              }
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function Dashboard() {
  const [counts, outstandingReports, escalatedGradingReview] = await Promise.all([
    dashboardCounts(),
    countOutstandingBookReports(),
    countEscalatedGradingReview(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Home</h1>
        <Button render={<Link href="/scan">Scan &amp; Upload</Link>} />
      </div>

      {escalatedGradingReview > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            {escalatedGradingReview} quiz code{escalatedGradingReview === 1 ? "" : "s"} in Grading
            Review {escalatedGradingReview === 1 ? "has" : "have"} been unresolved for 2+ weeks —
            add the missing answer key, or remove the scan.
          </span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Graded today" value={String(counts.gradedToday)} href="/graded-today" />
        <StatCard label="Grading Review" value={String(counts.gradingReview)} href="/review/grading" />
        <StatCard label="Needs Review" value={String(counts.assignmentReview)} href="/review/assignment" />
        <StatCard label="Outstanding reports" value={String(outstandingReports)} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        The full Reports screen and Book Report Tracker (Outstanding/Escalated list, the escalation
        banner for outstanding reports) are Milestone 2 — the Outstanding Reports count above is
        real, but there&apos;s no dedicated view for it yet.
      </p>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const card = (
    <Card className={href ? "transition-colors hover:border-primary/40" : undefined}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
