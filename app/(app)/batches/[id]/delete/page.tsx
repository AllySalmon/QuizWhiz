import { notFound } from "next/navigation";
import { getBatch } from "@/lib/db/queries/batches";
import { countsForBatch } from "@/lib/db/queries/testRecords";
import { deleteBatchAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function DeleteBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, counts] = await Promise.all([getBatch(id), countsForBatch(id)]);
  if (!batch) notFound();

  const boundAction = deleteBatchAction.bind(null, id);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Delete &quot;{batch.label}&quot;</h1>
      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
        This permanently deletes all {counts.total} test{counts.total === 1 ? "" : "s"} in this batch —
        scores, scan images, and any book reports they created. This can&apos;t be undone.
      </div>
      <form action={boundAction} className="mt-4">
        <Button type="submit" variant="destructive">
          Delete batch and all {counts.total} test{counts.total === 1 ? "" : "s"}
        </Button>
      </form>
    </div>
  );
}
