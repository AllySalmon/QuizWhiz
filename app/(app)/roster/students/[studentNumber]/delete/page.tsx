import { notFound } from "next/navigation";
import { getStudent } from "@/lib/db/queries/studentRoster";
import { RosterTabs } from "../../../RosterTabs";
import { deleteStudentAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function DeleteStudentPage({
  params,
}: {
  params: Promise<{ studentNumber: string }>;
}) {
  const { studentNumber } = await params;
  const student = await getStudent(studentNumber);
  if (!student) notFound();

  const boundAction = deleteStudentAction.bind(null, studentNumber);

  return (
    <div>
      <RosterTabs active="students" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Remove student {studentNumber}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This removes them from the roster. Any past test scores aren&apos;t deleted — they&apos;d
          just show as unassigned again if this student number is scanned in the future.
        </p>
        <form action={boundAction} className="mt-4">
          <Button type="submit" variant="destructive">
            Remove student {studentNumber}
          </Button>
        </form>
      </div>
    </div>
  );
}
