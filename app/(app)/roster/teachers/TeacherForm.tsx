"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeacherFormState } from "./actions";

type Props = {
  mode: "create" | "edit";
  action: (state: TeacherFormState, formData: FormData) => Promise<TeacherFormState>;
  initial?: { firstName: string; lastName: string };
};

const initialState: TeacherFormState = { error: null };

export function TeacherForm({ mode, action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={initial?.firstName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={initial?.lastName} required />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add teacher" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
