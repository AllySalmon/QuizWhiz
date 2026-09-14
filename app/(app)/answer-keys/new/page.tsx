import { AnswerKeyForm } from "../AnswerKeyForm";
import { createAnswerKeyAction } from "../actions";

export default function NewAnswerKeyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add answer key</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The quiz code should match what&apos;s printed on the test sheet.
      </p>

      <div className="mt-6">
        <AnswerKeyForm mode="create" action={createAnswerKeyAction} />
      </div>
    </div>
  );
}
