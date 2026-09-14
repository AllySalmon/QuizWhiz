import Papa from "papaparse";

// Columns: first_name, last_name. New scope beyond Docs/ (only students had
// a documented CSV format) — added per the user's Milestone 1a feedback.

export type ExistingTeacher = { firstName: string; lastName: string };
export type TeacherImportRow = { firstName: string; lastName: string };

export type TeacherImportSummary = {
  totalRows: number;
  applied: TeacherImportRow[];
  skipped: {
    missingName: number;
    duplicateInFile: number;
    duplicateExisting: number;
  };
};

function nameKey(firstName: string, lastName: string) {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

export function parseTeacherCsv(csvText: string, existingTeachers: ExistingTeacher[]): TeacherImportSummary {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const existingKeys = new Set(existingTeachers.map((t) => nameKey(t.firstName, t.lastName)));
  const seenInFile = new Set<string>();

  const summary: TeacherImportSummary = {
    totalRows: data.length,
    applied: [],
    skipped: { missingName: 0, duplicateInFile: 0, duplicateExisting: 0 },
  };

  for (const row of data) {
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();
    if (!firstName || !lastName) {
      summary.skipped.missingName++;
      continue;
    }

    const key = nameKey(firstName, lastName);
    if (existingKeys.has(key)) {
      summary.skipped.duplicateExisting++;
      continue;
    }
    if (seenInFile.has(key)) {
      summary.skipped.duplicateInFile++;
      continue;
    }

    seenInFile.add(key);
    summary.applied.push({ firstName, lastName });
  }

  return summary;
}
