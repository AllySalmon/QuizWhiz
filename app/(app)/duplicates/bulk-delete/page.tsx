import { notFound } from "next/navigation";
import { getTestRecordsByIds } from "@/lib/db/queries/testRecords";
import { deleteManyDuplicatesAction } from "../actions";
import { Button } from "@/components/ui/button";

export default async function BulkDeleteDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const recordIds = idsParam ? idsParam.split(",").filter(Boolean) : [];
  if (recordIds.length === 0) notFound();

  const records = await getTestRecordsByIds(recordIds);
  if (records.length === 0) notFound();

  const boundAction = deleteManyDuplicatesAction.bind(null, recordIds);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Delete {records.length} scan{records.length === 1 ? "" : "s"}
      </h1>
      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
        This permanently deletes their scores, scan images, and any book reports they created. This
        can&apos;t be undone.
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {records.map((r) => (
          <li key={r.id} className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
            {r.quizCode ?? "—"} — {r.studentNumber ?? "unreadable"}
          </li>
        ))}
      </ul>
      <form action={boundAction} className="mt-4">
        <Button type="submit" variant="destructive">
          Delete {records.length} scan{records.length === 1 ? "" : "s"}
        </Button>
      </form>
    </div>
  );
}
