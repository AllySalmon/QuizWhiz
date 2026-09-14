import Papa from "papaparse";
import type { GradeBand } from "@/lib/db/queries/answerKeys";

// Expected columns: student_number, teacher_last_name, grade_band ("jr" or "3-5").
// This exact format isn't specified in Docs/ — it's a Milestone 1a decision
// (see the plan doc), matching how the docs themselves frame CSV rows
// ("student number -> teacher pairs").

export type ActiveTeacher = { id: string; firstName: string; lastName: string };

export type ImportRow = { studentNumber: string; teacherId: string; gradeBand: GradeBand };

export type ImportSummary = {
  totalRows: number;
  applied: ImportRow[];
  skipped: {
    missingStudentNumber: number;
    invalidGradeBand: number;
    unrecognizedTeacher: number;
    ambiguousTeacherName: number;
  };
};

const VALID_GRADE_BANDS: GradeBand[] = ["jr", "3-5"];

export function parseStudentRosterCsv(csvText: string, activeTeachers: ActiveTeacher[]): ImportSummary {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const teachersByLastName = new Map<string, ActiveTeacher[]>();
  for (const teacher of activeTeachers) {
    const key = teacher.lastName.trim().toLowerCase();
    const bucket = teachersByLastName.get(key);
    if (bucket) bucket.push(teacher);
    else teachersByLastName.set(key, [teacher]);
  }

  const summary: ImportSummary = {
    totalRows: data.length,
    applied: [],
    skipped: {
      missingStudentNumber: 0,
      invalidGradeBand: 0,
      unrecognizedTeacher: 0,
      ambiguousTeacherName: 0,
    },
  };

  for (const row of data) {
    const studentNumber = row.student_number?.trim();
    if (!studentNumber) {
      summary.skipped.missingStudentNumber++;
      continue;
    }

    const gradeBand = row.grade_band?.trim() as GradeBand | undefined;
    if (!gradeBand || !VALID_GRADE_BANDS.includes(gradeBand)) {
      summary.skipped.invalidGradeBand++;
      continue;
    }

    const teacherLastName = row.teacher_last_name?.trim().toLowerCase();
    const matches = teacherLastName ? teachersByLastName.get(teacherLastName) : undefined;

    if (!matches || matches.length === 0) {
      summary.skipped.unrecognizedTeacher++;
      continue;
    }
    if (matches.length > 1) {
      summary.skipped.ambiguousTeacherName++;
      continue;
    }

    summary.applied.push({ studentNumber, teacherId: matches[0].id, gradeBand });
  }

  return summary;
}
