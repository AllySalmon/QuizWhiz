"use server";

import { redirect } from "next/navigation";
import { upsertStudent, upsertManyStudents, deleteStudent, deleteManyStudents, getStudent } from "@/lib/db/queries/studentRoster";
import type { GradeBand } from "@/lib/db/queries/answerKeys";
import { listActiveTeachers } from "@/lib/db/queries/teachers";
import { parseStudentRosterCsv, type ImportSummary } from "@/lib/csv/studentRosterImport";

export type StudentFormState = { error: string | null };

function isValidGradeBand(v: unknown): v is GradeBand {
  return v === "jr" || v === "3-5";
}

type StudentFields =
  | { error: string }
  | { error: null; studentNumber: string; teacherId: string; gradeBand: GradeBand };

function readStudentFields(formData: FormData): StudentFields {
  const studentNumber = formData.get("studentNumber");
  const teacherId = formData.get("teacherId");
  const gradeBand = formData.get("gradeBand");

  if (typeof studentNumber !== "string" || !studentNumber.trim()) {
    return { error: "Enter a student number." };
  }
  if (typeof teacherId !== "string" || !teacherId) {
    return { error: "Choose a teacher." };
  }
  if (!isValidGradeBand(gradeBand)) {
    return { error: "Choose a grade band." };
  }

  return { error: null, studentNumber: studentNumber.trim(), teacherId, gradeBand };
}

// Create only — checks the student number isn't already in the roster
// before inserting, rather than silently upserting. Not a name-duplicate
// check (students are never named, per PRD §6) — this catches an accidental
// re-typed/duplicate student number instead.
export async function createStudentAction(
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const fields = readStudentFields(formData);
  if (fields.error !== null) return { error: fields.error };

  const existing = await getStudent(fields.studentNumber);
  if (existing) {
    return {
      error: `Student number ${fields.studentNumber} is already in the roster. Edit that student instead, or double-check the number.`,
    };
  }

  await upsertStudent(fields);
  redirect("/roster/students");
}

// Edit only — the form's studentNumber field is read-only and always
// resubmits the original value, so this is always updating the same row.
export async function upsertStudentAction(
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const fields = readStudentFields(formData);
  if (fields.error !== null) return { error: fields.error };

  await upsertStudent(fields);
  redirect("/roster/students");
}

export async function deleteStudentAction(studentNumber: string) {
  await deleteStudent(studentNumber);
  redirect("/roster/students");
}

export async function deleteManyStudentsAction(studentNumbers: string[]) {
  await deleteManyStudents(studentNumbers);
  redirect("/roster/students");
}

export type CsvImportState = { error: string | null; summary: ImportSummary | null };

export async function csvImportAction(
  _prevState: CsvImportState,
  formData: FormData
): Promise<CsvImportState> {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file.", summary: null };
  }

  const text = await file.text();
  const activeTeachers = await listActiveTeachers();
  const result = parseStudentRosterCsv(text, activeTeachers);

  await upsertManyStudents(result.applied);

  return { error: null, summary: result };
}
