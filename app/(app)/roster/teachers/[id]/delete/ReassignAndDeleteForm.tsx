"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DeleteTeacherState } from "../../actions";

type Student = { studentNumber: string; gradeBand: "jr" | "3-5" };
type OtherTeacher = { id: string; firstName: string; lastName: string };

type Props = {
  teacherName: string;
  students: Student[];
  otherTeachers: OtherTeacher[];
  action: (state: DeleteTeacherState, formData: FormData) => Promise<DeleteTeacherState>;
};

const initialState: DeleteTeacherState = { error: null };

export function ReassignAndDeleteForm({ teacherName, students, otherTeachers, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [assignments, setAssignments] = useState<Record<string, string | undefined>>({});

  function assignAll(teacherId: string) {
    const next: Record<string, string> = {};
    for (const s of students) next[s.studentNumber] = teacherId;
    setAssignments(next);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
        Before removing {teacherName}, reassign their {students.length}{" "}
        {students.length === 1 ? "student" : "students"} to another teacher.
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm text-muted-foreground">Assign all to</span>
        <Select onValueChange={(v) => assignAll(v as string)}>
          <SelectTrigger className="w-56">
            {/* See StudentForm.tsx for why this needs an explicit label
                lookup — Base UI's Select.Value can't resolve one from a
                closed dropdown's unmounted items. */}
            <SelectValue placeholder="Choose a teacher">
              {(value: string | null) => {
                if (!value) return "Choose a teacher";
                const teacher = otherTeachers.find((t) => t.id === value);
                return teacher ? `${teacher.firstName} ${teacher.lastName}` : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {otherTeachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">then override individual rows to split the class</span>
      </div>

      <div className="flex flex-col gap-2">
        {students.map((student) => (
          <div
            key={student.studentNumber}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="font-mono text-sm text-foreground">{student.studentNumber}</span>
            <Select
              name={`teacher_for_${student.studentNumber}`}
              value={assignments[student.studentNumber]}
              onValueChange={(v) =>
                setAssignments((prev) => ({ ...prev, [student.studentNumber]: v as string }))
              }
              required
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose a teacher">
                  {(value: string | null) => {
                    if (!value) return "Choose a teacher";
                    const teacher = otherTeachers.find((t) => t.id === value);
                    return teacher ? `${teacher.firstName} ${teacher.lastName}` : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {otherTeachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Removing…" : `Reassign and remove ${teacherName}`}
        </Button>
      </div>
    </form>
  );
}
