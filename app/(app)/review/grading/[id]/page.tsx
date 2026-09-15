import Link from "next/link";
import { notFound } from "next/navigation";
import { getTestRecord } from "@/lib/db/queries/testRecords";
import { getAnswerKeyByQuizCode } from "@/lib/db/queries/answerKeys";
import { getSignedScanImageUrl } from "@/lib/supabase/storage";
import { ReviewTabs } from "../../ReviewTabs";
import { correctQuizCodeAction, correctAnswersAction } from "../actions";
import { QuizCodeCorrectionForm } from "./QuizCodeCorrectionForm";
import { GradingAnswersForm } from "./GradingAnswersForm";

export default async function GradingReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { id } = await params;
  const { batch } = await searchParams;
  const record = await getTestRecord(id);
  if (!record) notFound();

  if (record.gradingStatus !== "needs_grading_review") {
    return (
      <div>
        <ReviewTabs active="grading" batchId={batch} />
        <p className="mt-8 text-sm text-muted-foreground">This item has already been resolved.</p>
      </div>
    );
  }

  const flagReasons = (record.flagReasons ?? []) as string[];
  const isUnrecognizedQuizCode = flagReasons.includes("unrecognized_quiz_code");

  const imageUrl = record.scanImageRef ? await getSignedScanImageUrl(record.scanImageRef) : null;

  return (
    <div>
      <ReviewTabs active="grading" batchId={batch} />

      <div className="mt-4 flex justify-end">
        <Link
          href={`/batches/${record.batchId}/${id}/delete`}
          className="text-sm font-medium text-destructive hover:underline"
        >
          Delete this scan
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Scanned test sheet" className="w-full rounded-lg" />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Scan image no longer available.</p>
          )}
        </div>

        <div>
          {isUnrecognizedQuizCode ? (
            <>
              <h1 className="text-lg font-semibold text-foreground">Quiz code not recognized</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                No answer key matches this code. Correct it, or add the missing answer key first.
              </p>
              <div className="mt-4">
                <QuizCodeCorrectionForm
                  action={correctQuizCodeAction.bind(null, id, batch ?? null)}
                  initialValue={record.quizCode ?? ""}
                />
              </div>
            </>
          ) : (
            <GradingReviewAnswers testRecordId={id} batchId={batch ?? null} record={record} />
          )}
        </div>
      </div>
    </div>
  );
}

async function GradingReviewAnswers({
  testRecordId,
  batchId,
  record,
}: {
  testRecordId: string;
  batchId: string | null;
  record: NonNullable<Awaited<ReturnType<typeof getTestRecord>>>;
}) {
  const matchedKey = record.quizCode ? await getAnswerKeyByQuizCode(record.quizCode) : null;
  if (!matchedKey) {
    return <p className="text-sm text-red-600">The matched answer key is missing.</p>;
  }

  const flagReasons = (record.flagReasons ?? []) as string[];
  const unclearQuestions = new Set(
    flagReasons
      .filter((f) => f.startsWith("unclear_answer_q"))
      .map((f) => Number(f.replace("unclear_answer_q", "")))
  );
  const currentAnswers = (record.answersJson ?? {}) as Record<string, "A" | "B" | "C" | "D" | null>;

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground">{matchedKey.bookTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confirm or correct what&apos;s actually circled — the score recalculates automatically.
      </p>
      <div className="mt-4">
        <GradingAnswersForm
          action={correctAnswersAction.bind(null, testRecordId, batchId)}
          questions={matchedKey.questions.map((q) => q.questionNumber)}
          currentAnswers={currentAnswers}
          unclearQuestions={unclearQuestions}
        />
      </div>
    </>
  );
}
