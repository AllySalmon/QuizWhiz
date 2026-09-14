import { listActiveTeachers } from "@/lib/db/queries/teachers";
import { RosterTabs } from "../../RosterTabs";
import { StudentForm } from "../StudentForm";
import { createStudentAction } from "../actions";

export default async function NewStudentPage() {
  const teachers = await listActiveTeachers();

  return (
    <div>
      <RosterTabs active="students" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Add student</h1>
        <div className="mt-4">
          <StudentForm mode="create" action={createStudentAction} teachers={teachers} />
        </div>
      </div>
    </div>
  );
}
