import { notFound } from "next/navigation";
import { getTestRecord } from "@/lib/db/queries/testRecords";
import { deleteTestRecordAction } from "../../../actions";
import { Button } from "@/components/ui/button";

export default async function DeleteTestRecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  const record = await getTestRecord(recordId);
  if (!record || record.batchId !== id) notFound();

  const boundAction = deleteTestRecordAction.bind(null, id, recordId);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Delete this scan</h1>
      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
        This permanently deletes the scan for student{" "}
        <span className="font-mono">{record.studentNumber ?? "(unreadable)"}</span> — its score, scan
        image, and any book report it created. This can&apos;t be undone.
      </div>
      <form action={boundAction} className="mt-4">
        <Button type="submit" variant="destructive">
          Delete this scan
        </Button>
      </form>
    </div>
  );
}
