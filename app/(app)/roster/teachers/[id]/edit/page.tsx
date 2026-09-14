import { notFound } from "next/navigation";
import { getTeacher } from "@/lib/db/queries/teachers";
import { RosterTabs } from "../../../RosterTabs";
import { TeacherForm } from "../../TeacherForm";
import { renameTeacherAction } from "../../actions";

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await getTeacher(id);
  if (!teacher) notFound();

  const boundAction = renameTeacherAction.bind(null, id);

  return (
    <div>
      <RosterTabs active="teachers" />
      <div className="mx-auto mt-6 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Rename teacher</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every student and past record assigned to this teacher updates automatically.
        </p>
        <div className="mt-4">
          <TeacherForm
            mode="edit"
            action={boundAction}
            initial={{ firstName: teacher.firstName, lastName: teacher.lastName }}
          />
        </div>
      </div>
    </div>
  );
}
