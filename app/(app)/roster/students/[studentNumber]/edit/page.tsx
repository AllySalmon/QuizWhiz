import { notFound } from "next/navigation";
import { getStudent } from "@/lib/db/queries/studentRoster";
import { listActiveTeachers } from "@/lib/db/queries/teachers";
import { RosterTabs } from "../../../RosterTabs";
import { StudentForm } from "../../StudentForm";
import { upsertStudentAction } from "../../actions";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ studentNumber: string }>;
}) {
  const { studentNumber } = await params;
  const [student, teachers] = await Promise.all([getStudent(studentNumber), listActiveTeachers()]);
  if (!student) notFound();

  return (
    <div>
      <RosterTabs active="students" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Edit student</h1>
        <div className="mt-4">
          <StudentForm
            mode="edit"
            action={upsertStudentAction}
            teachers={teachers}
            initial={{
              studentNumber: student.studentNumber,
              teacherId: student.teacherId,
              gradeBand: student.gradeBand,
            }}
          />
        </div>
      </div>
    </div>
  );
}
