"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssignmentCorrectionState } from "../actions";

type Teacher = { id: string; firstName: string; lastName: string };

export function AssignmentCorrectionForm({
  action,
  initialStudentNumber,
  teachers,
  suggestedTeacherId,
}: {
  action: (state: AssignmentCorrectionState, formData: FormData) => Promise<AssignmentCorrectionState>;
  initialStudentNumber: string;
  teachers: Teacher[];
  suggestedTeacherId?: string;
}) {
  const [state, formAction, pending] = useActionState<AssignmentCorrectionState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studentNumber">Student number</Label>
        <Input id="studentNumber" name="studentNumber" defaultValue={initialStudentNumber} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="teacherId">Teacher</Label>
        <Select name="teacherId" defaultValue={suggestedTeacherId} required>
          <SelectTrigger id="teacherId" className="w-full">
            <SelectValue placeholder="Choose a teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Confirm assignment"}
        </Button>
      </div>
    </form>
  );
}
