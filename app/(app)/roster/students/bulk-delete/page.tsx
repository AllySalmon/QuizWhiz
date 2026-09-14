import { notFound } from "next/navigation";
import { RosterTabs } from "../../RosterTabs";
import { deleteManyStudentsAction } from "../actions";
import { Button } from "@/components/ui/button";

export default async function BulkDeleteStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const studentNumbers = idsParam ? idsParam.split(",").filter(Boolean) : [];
  if (studentNumbers.length === 0) notFound();

  const boundAction = deleteManyStudentsAction.bind(null, studentNumbers);

  return (
    <div>
      <RosterTabs active="students" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Remove {studentNumbers.length} student{studentNumbers.length === 1 ? "" : "s"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This removes them from the roster. Any past test scores aren&apos;t deleted — they&apos;d
          just show as unassigned again if these student numbers are scanned in the future.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {studentNumbers.map((n) => (
            <li key={n} className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
              {n}
            </li>
          ))}
        </ul>
        <form action={boundAction} className="mt-4">
          <Button type="submit" variant="destructive">
            Remove {studentNumbers.length} student{studentNumbers.length === 1 ? "" : "s"}
          </Button>
        </form>
      </div>
    </div>
  );
}
