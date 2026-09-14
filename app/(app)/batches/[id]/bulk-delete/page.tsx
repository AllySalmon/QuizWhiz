import { notFound } from "next/navigation";
import { getTestRecordsByIds } from "@/lib/db/queries/testRecords";
import { deleteManyTestRecordsAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function BulkDeleteTestRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { id } = await params;
  const { ids: idsParam } = await searchParams;
  const recordIds = idsParam ? idsParam.split(",").filter(Boolean) : [];
  if (recordIds.length === 0) notFound();

  const records = await getTestRecordsByIds(recordIds);
  if (records.length === 0) notFound();

  const boundAction = deleteManyTestRecordsAction.bind(null, id, recordIds);

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
            #{r.scanOrder} — {r.studentNumber ?? "unreadable"}
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
