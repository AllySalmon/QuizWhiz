"use server";

import { redirect } from "next/navigation";
import { correctAssignment } from "@/lib/db/queries/testRecords";

export type AssignmentCorrectionState = { error: string | null };

export async function correctAssignmentAction(
  id: string,
  batchId: string | null,
  _prevState: AssignmentCorrectionState,
  formData: FormData
): Promise<AssignmentCorrectionState> {
  const studentNumber = formData.get("studentNumber");
  const teacherId = formData.get("teacherId");

  if (typeof studentNumber !== "string" || !studentNumber.trim()) {
    return { error: "Enter a student number." };
  }
  if (typeof teacherId !== "string" || !teacherId) {
    return { error: "Choose a teacher." };
  }

  await correctAssignment(id, { studentNumber: studentNumber.trim(), teacherId });

  redirect(batchId ? `/review/assignment?batch=${batchId}` : "/review/assignment");
}
