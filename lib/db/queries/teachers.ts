import "server-only";
import { eq, ne, asc, count, and, ilike } from "drizzle-orm";
import { getDb } from "../client";
import { teachers, studentRoster, auditLog } from "../schema";

export async function listTeachersWithStudentCounts() {
  const db = getDb();
  return db
    .select({
      id: teachers.id,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
      studentCount: count(studentRoster.studentNumber),
    })
    .from(teachers)
    .leftJoin(studentRoster, eq(studentRoster.teacherId, teachers.id))
    .where(eq(teachers.isActive, true))
    .groupBy(teachers.id)
    .orderBy(asc(teachers.lastName), asc(teachers.firstName));
}

export async function listActiveTeachers(excludeId?: string) {
  const db = getDb();
  const where = excludeId
    ? and(eq(teachers.isActive, true), ne(teachers.id, excludeId))
    : eq(teachers.isActive, true);

  return db
    .select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName })
    .from(teachers)
    .where(where)
    .orderBy(asc(teachers.lastName), asc(teachers.firstName));
}

export async function getTeacher(id: string) {
  const db = getDb();
  const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
  return teacher ?? null;
}

// Case-insensitive exact match on both names, active teachers only.
// excludeId lets renameTeacher check "does this name match anyone ELSE".
export async function findTeacherByFullName(
  firstName: string,
  lastName: string,
  excludeId?: string
) {
  const db = getDb();
  const conditions = [
    eq(teachers.isActive, true),
    ilike(teachers.firstName, firstName.trim()),
    ilike(teachers.lastName, lastName.trim()),
  ];
  if (excludeId) conditions.push(ne(teachers.id, excludeId));

  const [match] = await db
    .select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName })
    .from(teachers)
    .where(and(...conditions));
  return match ?? null;
}

export async function createTeacher(input: { firstName: string; lastName: string }) {
  const db = getDb();
  const [teacher] = await db.insert(teachers).values(input).returning();
  return teacher;
}

// Used by the CSV import (lib/csv/teacherImport.ts) after it has already
// filtered out missing-name and duplicate rows (against both the existing
// roster and other rows in the same file).
export async function createManyTeachers(rows: { firstName: string; lastName: string }[]) {
  if (rows.length === 0) return 0;
  const db = getDb();
  await db.insert(teachers).values(rows);
  return rows.length;
}

// Rename cascades for free — every FK reference (student_roster.teacher_id,
// test_records.resolved_teacher_id, book_reports.teacher_id) points at the
// same row id, so no downstream update is needed (Docs/1-PRD.md §5.8).
export async function renameTeacher(id: string, input: { firstName: string; lastName: string }) {
  const db = getDb();
  const [teacher] = await db
    .update(teachers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(teachers.id, id))
    .returning();
  return teacher;
}

export async function getStudentsForTeacher(teacherId: string) {
  const db = getDb();
  return db
    .select({
      studentNumber: studentRoster.studentNumber,
      gradeBand: studentRoster.gradeBand,
    })
    .from(studentRoster)
    .where(eq(studentRoster.teacherId, teacherId))
    .orderBy(asc(studentRoster.studentNumber));
}

// Reassigns every listed student to their chosen teacher, logs the action,
// then soft-deletes the teacher — one transaction, per Docs/1-PRD.md §5.8
// ("deletion is blocked until every student has been reassigned").
export async function reassignAndDeleteTeacher(
  teacherId: string,
  assignments: { studentNumber: string; newTeacherId: string }[]
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    for (const { studentNumber, newTeacherId } of assignments) {
      await tx
        .update(studentRoster)
        .set({ teacherId: newTeacherId, updatedAt: new Date() })
        .where(eq(studentRoster.studentNumber, studentNumber));
    }

    await tx.insert(auditLog).values({
      action: "teacher_deleted_reassigned",
      entityType: "teacher",
      entityId: teacherId,
      details: { reassignedCount: assignments.length, assignments },
    });

    const [teacher] = await tx
      .update(teachers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teachers.id, teacherId))
      .returning();

    return teacher;
  });
}

export async function teachersExist() {
  const db = getDb();
  const [row] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .limit(1);
  return Boolean(row);
}
