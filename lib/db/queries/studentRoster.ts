import "server-only";
import { eq, ilike, or, asc } from "drizzle-orm";
import { getDb } from "../client";
import { studentRoster, teachers, auditLog } from "../schema";
import type { GradeBand } from "./answerKeys";

export async function listStudents(search?: string) {
  const db = getDb();

  const base = db
    .select({
      studentNumber: studentRoster.studentNumber,
      gradeBand: studentRoster.gradeBand,
      teacherId: studentRoster.teacherId,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
    })
    .from(studentRoster)
    .leftJoin(teachers, eq(studentRoster.teacherId, teachers.id));

  const query = search
    ? base.where(
        or(
          ilike(studentRoster.studentNumber, `%${search}%`),
          ilike(teachers.lastName, `%${search}%`)
        )
      )
    : base;

  return query.orderBy(asc(studentRoster.studentNumber));
}

export async function getStudent(studentNumber: string) {
  const db = getDb();
  const [student] = await db
    .select()
    .from(studentRoster)
    .where(eq(studentRoster.studentNumber, studentNumber));
  return student ?? null;
}

export async function upsertStudent(input: {
  studentNumber: string;
  teacherId: string;
  gradeBand: GradeBand;
}) {
  const db = getDb();
  const [student] = await db
    .insert(studentRoster)
    .values(input)
    .onConflictDoUpdate({
      target: studentRoster.studentNumber,
      set: { teacherId: input.teacherId, gradeBand: input.gradeBand, updatedAt: new Date() },
    })
    .returning();
  return student;
}

// Used by the CSV import (lib/csv/studentRosterImport.ts) after it has
// already resolved each row's teacher and validated the grade band —
// this function just applies the upsert, per row, inside one transaction.
export async function upsertManyStudents(
  rows: { studentNumber: string; teacherId: string; gradeBand: GradeBand }[]
) {
  if (rows.length === 0) return 0;
  const db = getDb();

  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(studentRoster)
        .values(row)
        .onConflictDoUpdate({
          target: studentRoster.studentNumber,
          set: { teacherId: row.teacherId, gradeBand: row.gradeBand, updatedAt: new Date() },
        });
    }
  });

  return rows.length;
}

// Hard delete — student_roster has no soft-delete flag (unlike teachers).
// Safe against the schema: test_records/book_reports reference student_number
// by value, not a FK (Docs/5-Backend-Schema.md §3), so historical records
// survive and simply become "not in the roster" again if referenced later —
// the same state a never-added student is already in.
export async function deleteStudent(studentNumber: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(studentRoster).where(eq(studentRoster.studentNumber, studentNumber));
    await tx.insert(auditLog).values({
      action: "student_deleted",
      entityType: "student_roster",
      entityId: studentNumber,
      details: {},
    });
  });
}

export async function studentRosterExists() {
  const db = getDb();
  const [row] = await db
    .select({ studentNumber: studentRoster.studentNumber })
    .from(studentRoster)
    .limit(1);
  return Boolean(row);
}
