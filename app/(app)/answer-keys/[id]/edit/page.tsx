import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnswerKeyWithQuestions } from "@/lib/db/queries/answerKeys";
import { AnswerKeyForm } from "../../AnswerKeyForm";
import { updateAnswerKeyAction } from "../../actions";

export default async function EditAnswerKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = await getAnswerKeyWithQuestions(id);
  if (!key) notFound();

  const boundAction = updateAnswerKeyAction.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit answer key</h1>
          <p className="mt-1 text-sm text-muted-foreground">{key.bookTitle}</p>
        </div>
        <Link href={`/answer-keys/${id}/delete`} className="text-sm font-medium text-destructive hover:underline">
          Delete
        </Link>
      </div>

      <div className="mt-6">
        <AnswerKeyForm
          mode="edit"
          action={boundAction}
          initial={{
            quizCode: key.quizCode,
            bookTitle: key.bookTitle,
            gradeBand: key.gradeBand,
            questions: key.questions.map((q) => ({
              questionNumber: q.questionNumber,
              correctAnswer: q.correctAnswer,
            })),
          }}
        />
      </div>
    </div>
  );
}
