import { notFound } from "next/navigation";
import { getAnswerKeyWithQuestions } from "@/lib/db/queries/answerKeys";
import { countTestRecordsForQuizCode } from "@/lib/db/queries/testRecords";
import { deleteAnswerKeyAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function DeleteAnswerKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = await getAnswerKeyWithQuestions(id);
  if (!key) notFound();

  const testCount = await countTestRecordsForQuizCode(key.quizCode);
  const boundAction = deleteAnswerKeyAction.bind(null, id);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Delete &quot;{key.bookTitle}&quot;</h1>
      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
        {testCount > 0 ? (
          <>
            {testCount} already-graded test{testCount === 1 ? "" : "s"} used quiz code{" "}
            <span className="font-mono">{key.quizCode}</span> — those keep their scores. But once this key
            is deleted, that quiz code won&apos;t match any new scans until you add it again.
          </>
        ) : (
          <>
            This permanently removes the answer key for quiz code{" "}
            <span className="font-mono">{key.quizCode}</span>.
          </>
        )}{" "}
        This can&apos;t be undone.
      </div>
      <form action={boundAction} className="mt-4">
        <Button type="submit" variant="destructive">
          Delete answer key
        </Button>
      </form>
    </div>
  );
}
