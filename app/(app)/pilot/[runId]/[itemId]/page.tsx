import { notFound } from "next/navigation";
import { getRunItem } from "@/lib/db/queries/comparisonRuns";
import { getSignedScanImageUrl } from "@/lib/supabase/storage";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function PilotItemDetailPage({
  params,
}: {
  params: Promise<{ runId: string; itemId: string }>;
}) {
  const { itemId } = await params;
  const item = await getRunItem(itemId);
  if (!item) notFound();

  const imageUrl = item.scanImageRef ? await getSignedScanImageUrl(item.scanImageRef) : null;
  const groundTruthAnswers = (item.answersJson ?? {}) as Record<string, string>;
  const aiAnswers = (item.aiAnswersJson ?? {}) as Record<string, string | null>;
  const questionNumbers = Object.keys(groundTruthAnswers)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Scanned test sheet" className="w-full rounded-lg" />
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Scan image not available.</p>
        )}
      </div>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Student {item.studentNumber} — {item.quizCode}
        </h1>

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Field</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ground truth</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">AI read</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Match</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow label="Quiz code" truth={item.quizCode} ai={item.aiQuizCode} match={item.quizCodeMatch} />
              <FieldRow
                label="Student #"
                truth={item.studentNumber}
                ai={item.aiStudentNumber}
                match={item.studentNumberMatch}
              />
              <FieldRow
                label="Teacher"
                truth={item.teacherLastName}
                ai={item.aiTeacherLastName}
                match={item.teacherNameMatch}
              />
              {questionNumbers.map((q) => (
                <FieldRow
                  key={q}
                  label={`Q${q}`}
                  truth={groundTruthAnswers[String(q)]}
                  ai={aiAnswers[String(q)]}
                  match={groundTruthAnswers[String(q)] === aiAnswers[String(q)]}
                />
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Ground-truth score:</dt>
            <dd className="text-foreground">{Number(item.groundTruthScore).toFixed(0)}%</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">AI-computed score:</dt>
            <dd className="text-foreground">
              {item.aiScore !== null ? `${Number(item.aiScore).toFixed(0)}%` : "— (quiz code unmatched)"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Would have been flagged for review:</dt>
            <dd className="text-foreground">{item.wouldHaveBeenClean ? "No" : "Yes"}</dd>
          </div>
          {item.falseClean && (
            <p className="mt-1 text-sm font-medium text-destructive">
              False clean — this would have graded silently, and the score was wrong.
            </p>
          )}
        </dl>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  truth,
  ai,
  match,
}: {
  label: string;
  truth: string | null;
  ai: string | null;
  match: boolean;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
      <td className="px-3 py-1.5 text-foreground">{truth ?? "—"}</td>
      <td className="px-3 py-1.5 text-foreground">{ai ?? "—"}</td>
      <td className="px-3 py-1.5">
        {match ? (
          <CheckCircle2 className="size-4 text-primary" aria-label="match" />
        ) : (
          <XCircle className="size-4 text-destructive" aria-label="mismatch" />
        )}
      </td>
    </tr>
  );
}
