import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { getTeacher, getStudentsForTeacher, listActiveTeachers, reassignAndDeleteTeacher } from "@/lib/db/queries/teachers";
import { RosterTabs } from "../../../RosterTabs";
import { reassignAndDeleteTeacherAction } from "../../actions";
import { ReassignAndDeleteForm } from "./ReassignAndDeleteForm";
import { Button } from "@/components/ui/button";

export default async function DeleteTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [teacher, students, otherTeachers] = await Promise.all([
    getTeacher(id),
    getStudentsForTeacher(id),
    listActiveTeachers(id),
  ]);
  if (!teacher) notFound();

  const teacherName = `${teacher.firstName} ${teacher.lastName}`;

  if (students.length === 0) {
    async function removeTeacher() {
      "use server";
      await reassignAndDeleteTeacher(id, []);
      redirect("/roster/teachers");
    }

    return (
      <div>
        <RosterTabs active="teachers" />
        <div className="mx-auto mt-6 max-w-md">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {teacherName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No students are currently assigned to {teacherName}.
          </p>
          <form action={removeTeacher} className="mt-4">
            <Button type="submit" variant="destructive">
              Remove {teacherName}
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {teacherName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {teacherName} has {students.length} students, and there&apos;s no other teacher to reassign them
            to yet. Add another teacher first.
          </p>
        </div>
      </div>
    );
  }

  const boundAction = reassignAndDeleteTeacherAction.bind(
    null,
    id,
    students.map((s) => s.studentNumber)
  );

  return (
    <div>
      <RosterTabs active="teachers" />
      <div className="mx-auto mt-6 max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Remove {teacherName}</h1>
        <div className="mt-4">
          <ReassignAndDeleteForm
            teacherName={teacherName}
            students={students}
            otherTeachers={otherTeachers}
            action={boundAction}
          />
        </div>
      </div>
    </div>
  );
}
