import { RosterTabs } from "../../RosterTabs";
import { TeacherForm } from "../TeacherForm";
import { createTeacherAction } from "../actions";

export default function NewTeacherPage() {
  return (
    <div>
      <RosterTabs active="teachers" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Add teacher</h1>
        <div className="mt-4">
          <TeacherForm mode="create" action={createTeacherAction} />
        </div>
      </div>
    </div>
  );
}
