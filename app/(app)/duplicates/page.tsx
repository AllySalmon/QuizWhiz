import { listPossibleDuplicates } from "@/lib/db/queries/testRecords";
import { DuplicatesTable } from "./DuplicatesTable";

// Global, cross-batch view of the duplicate flag (lib/db/queries/testRecords.ts).
// Deliberately not a third review queue — every record here is exactly as
// resolved as it already was; this is visibility plus a bulk-delete
// shortcut, not a new resolution workflow.
export default async function DuplicatesPage() {
  const records = await listPossibleDuplicates();

  const groups = new Map<string, { key: string; bookLabel: string; studentNumber: string; rows: typeof records }>();
  for (const r of records) {
    const key = `${r.studentNumber}::${r.quizCode}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        bookLabel: r.bookTitle ?? r.quizCode ?? "—",
        studentNumber: r.studentNumber ?? "—",
        rows: [],
      });
    }
    groups.get(key)!.rows.push(r);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Possible Duplicates</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Duplicate scans usually mean the same paper test was scanned twice by accident — safe to
        delete the extras.
      </p>

      {groups.size === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No possible duplicates right now.</p>
      ) : (
        <div className="mt-6">
          <DuplicatesTable groups={[...groups.values()]} />
        </div>
      )}
    </div>
  );
}
