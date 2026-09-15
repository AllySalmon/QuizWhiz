"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StudentFormState } from "./actions";

type Teacher = { id: string; firstName: string; lastName: string };

type Props = {
  mode: "create" | "edit";
  action: (state: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  teachers: Teacher[];
  initial?: { studentNumber: string; teacherId: string | null; gradeBand: "jr" | "3-5" };
};

const initialState: StudentFormState = { error: null };

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

export function StudentForm({ mode, action, teachers, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studentNumber">Student number</Label>
        <Input
          id="studentNumber"
          name="studentNumber"
          defaultValue={initial?.studentNumber}
          readOnly={mode === "edit"}
          required
          className={mode === "edit" ? "cursor-not-allowed bg-input/50 opacity-50" : undefined}
        />
        {/* Docs/8-Pivot-Addendum.md §9.4 — the "student number, never a name"
            design assumed a school context where real ID numbers already
            existed; a fresh public signup has no such system, so this needs
            to be said explicitly, right where someone's about to type one. */}
        <p className="text-xs text-muted-foreground">Use a made-up number, not a real name or ID.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teacherId">Teacher</Label>
          <Select name="teacherId" defaultValue={initial?.teacherId ?? undefined} required>
            <SelectTrigger id="teacherId" className="w-full">
              {/* Base UI's Select.Value only auto-resolves a label while its
                  items are mounted (i.e. the popup is open) — closed, it
                  falls back to the raw value. An explicit render function
                  sidesteps that instead of showing the teacher's UUID. */}
              <SelectValue placeholder="Choose a teacher">
                {(value: string | null) => {
                  if (!value) return "Choose a teacher";
                  const teacher = teachers.find((t) => t.id === value);
                  return teacher ? `${teacher.firstName} ${teacher.lastName}` : value;
                }}
              </SelectValue>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gradeBand">Grade band</Label>
          <Select name="gradeBand" defaultValue={initial?.gradeBand} required>
            <SelectTrigger id="gradeBand" className="w-full">
              <SelectValue placeholder="Choose a grade band">
                {(value: "jr" | "3-5" | null) => (value ? GRADE_BAND_LABEL[value] : "Choose a grade band")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jr">SSYRA Jr.</SelectItem>
              <SelectItem value="3-5">SSYRA 3–5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add student" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
