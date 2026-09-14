import Link from "next/link";
import { listBatches } from "@/lib/db/queries/batches";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function BatchesPage() {
  const batches = await listBatches();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scan History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every batch you&apos;ve uploaded, most recent first.</p>

      {batches.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No batches yet — scanned tests will show up here once you upload some.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Tests</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="text-foreground">{batch.label}</TableCell>
                  <TableCell>{batch.itemCount}</TableCell>
                  <TableCell className="flex justify-end gap-4 text-right">
                    <Link href={`/batches/${batch.id}`} className="text-sm font-medium text-primary hover:underline">
                      View
                    </Link>
                    <Link
                      href={`/batches/${batch.id}/delete`}
                      className="text-sm font-medium text-destructive hover:underline"
                    >
                      Delete
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
