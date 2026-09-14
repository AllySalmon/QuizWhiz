import { notFound, redirect } from "next/navigation";
import {
  getTeachersByIds,
  getStudentsForTeachers,
  listActiveTeachersExcluding,
  reassignAndDeleteTeachers,
} from "@/lib/db/queries/teachers";
import { RosterTabs } from "../../RosterTabs";
import { reassignAndDeleteTeachersAction } from "../actions";
import { ReassignAndDeleteForm } from "../[id]/delete/ReassignAndDeleteForm";
import { Button } from "@/components/ui/button";

export default async function BulkDeleteTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const teacherIds = idsParam ? idsParam.split(",").filter(Boolean) : [];
  if (teacherIds.length === 0) notFound();

  const [teachers, students, otherTeachers] = await Promise.all([
    getTeachersByIds(teacherIds),
    getStudentsForTeachers(teacherIds),
    listActiveTeachersExcluding(teacherIds),
  ]);
  if (teachers.length === 0) notFound();

  const namesLabel =
    teachers.length === 1
      ? `${teachers[0].firstName} ${teachers[0].lastName}`
      : `${teachers.length} teachers (${teachers.map((t) => t.lastName).join(", ")})`;

  if (students.length === 0) {
    async function removeTeachers() {
      "use server";
      await reassignAndDeleteTeachers(teacherIds, []);
      redirect("/roster/teachers");
    }

    return (
      <div>
        <RosterTabs active="teachers" />
        <div className="mx-auto mt-6 max-w-md">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {namesLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">No students are currently assigned to them.</p>
          <form action={removeTeachers} className="mt-4">
            <Button type="submit" variant="destructive">
              Remove {teachers.length === 1 ? namesLabel : `${teachers.length} teachers`}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (otherTeachers.length === 0) {
    return (
      <div>
        <RosterTabs active="teachers" />
        <div className="mx-auto mt-6 max-w-md">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {namesLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            They have {students.length} students combined, and there&apos;s no other teacher to reassign
            them to yet. Add another teacher first.
          </p>
        </div>
      </div>
    );
  }

  const boundAction = reassignAndDeleteTeachersAction.bind(
    null,
    teacherIds,
    students.map((s) => s.studentNumber)
  );

  return (
    <div>
      <RosterTabs active="teachers" />
      <div className="mx-auto mt-6 max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {namesLabel}</h1>
        <div className="mt-4">
          <ReassignAndDeleteForm
            teacherName={namesLabel}
            students={students}
            otherTeachers={otherTeachers}
            action={boundAction}
          />
        </div>
      </div>
    </div>
  );
}
