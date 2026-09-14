"use server";

import { redirect } from "next/navigation";
import {
  createTeacher,
  renameTeacher,
  reassignAndDeleteTeacher,
  reassignAndDeleteTeachers,
  findTeacherByFullName,
  listActiveTeachers,
  createManyTeachers,
} from "@/lib/db/queries/teachers";
import { parseTeacherCsv, type TeacherImportSummary } from "@/lib/csv/teacherImport";

export type TeacherFormState = { error: string | null };

function readNames(formData: FormData): { firstName: string; lastName: string } | null {
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  if (typeof firstName !== "string" || !firstName.trim()) return null;
  if (typeof lastName !== "string" || !lastName.trim()) return null;
  return { firstName: firstName.trim(), lastName: lastName.trim() };
}

function duplicateNameError(firstName: string, lastName: string): string {
  return `A teacher named ${firstName} ${lastName} already exists. Add a middle initial or suffix to tell them apart (e.g. "${firstName} B. ${lastName}" or "${firstName} ${lastName} Jr.").`;
}

export async function createTeacherAction(
  _prevState: TeacherFormState,
  formData: FormData
): Promise<TeacherFormState> {
  const names = readNames(formData);
  if (!names) return { error: "Enter a first and last name." };

  const duplicate = await findTeacherByFullName(names.firstName, names.lastName);
  if (duplicate) return { error: duplicateNameError(names.firstName, names.lastName) };

  await createTeacher(names);
  redirect("/roster/teachers");
}

export async function renameTeacherAction(
  id: string,
  _prevState: TeacherFormState,
  formData: FormData
): Promise<TeacherFormState> {
  const names = readNames(formData);
  if (!names) return { error: "Enter a first and last name." };

  const duplicate = await findTeacherByFullName(names.firstName, names.lastName, id);
  if (duplicate) return { error: duplicateNameError(names.firstName, names.lastName) };

  await renameTeacher(id, names);
  redirect("/roster/teachers");
}

export type TeacherCsvImportState = { error: string | null; summary: TeacherImportSummary | null };

export async function csvImportTeachersAction(
  _prevState: TeacherCsvImportState,
  formData: FormData
): Promise<TeacherCsvImportState> {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file.", summary: null };
  }

  const text = await file.text();
  const existingTeachers = await listActiveTeachers();
  const result = parseTeacherCsv(text, existingTeachers);

  await createManyTeachers(result.applied);

  return { error: null, summary: result };
}

export type DeleteTeacherState = { error: string | null };

export async function reassignAndDeleteTeacherAction(
  teacherId: string,
  studentNumbers: string[],
  _prevState: DeleteTeacherState,
  formData: FormData
): Promise<DeleteTeacherState> {
  const assignments: { studentNumber: string; newTeacherId: string }[] = [];

  for (const studentNumber of studentNumbers) {
    const newTeacherId = formData.get(`teacher_for_${studentNumber}`);
    if (typeof newTeacherId !== "string" || !newTeacherId) {
      return { error: "Choose a teacher for every student before removing this teacher." };
    }
    if (newTeacherId === teacherId) {
      return { error: "Students can't be reassigned to the teacher being removed." };
    }
    assignments.push({ studentNumber, newTeacherId });
  }

  await reassignAndDeleteTeacher(teacherId, assignments);
  redirect("/roster/teachers");
}

export async function reassignAndDeleteTeachersAction(
  teacherIds: string[],
  studentNumbers: string[],
  _prevState: DeleteTeacherState,
  formData: FormData
): Promise<DeleteTeacherState> {
  const assignments: { studentNumber: string; newTeacherId: string }[] = [];

  for (const studentNumber of studentNumbers) {
    const newTeacherId = formData.get(`teacher_for_${studentNumber}`);
    if (typeof newTeacherId !== "string" || !newTeacherId) {
      return { error: "Choose a teacher for every student before removing these teachers." };
    }
    if (teacherIds.includes(newTeacherId)) {
      return { error: "Students can't be reassigned to a teacher also being removed." };
    }
    assignments.push({ studentNumber, newTeacherId });
  }

  await reassignAndDeleteTeachers(teacherIds, assignments);
  redirect("/roster/teachers");
}
