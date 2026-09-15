import * as XLSX from "xlsx";
import type { TeacherReportGroup } from "@/lib/db/queries/testRecords";

// One sheet, teacher-grouped rows in order (a blank row + teacher heading
// between groups) — she can filter/sort further herself once it's in a
// spreadsheet app, per Docs/1-PRD.md §5.6 ("she can then combine or forward
// batches as fits her workflow").
export function buildReportWorkbook(batchLabel: string, groups: TeacherReportGroup[]): Buffer {
  const sheetRows: (string | number)[][] = [
    ["Teacher", "Student #", "Book", "Score", "Result", "Date Tested"],
  ];

  for (const group of groups) {
    for (const row of group.rows) {
      sheetRows.push([
        `${group.teacherFirstName} ${group.teacherLastName}`,
        row.studentNumber ?? "",
        row.bookTitle ?? row.quizCode ?? "",
        row.scorePercent !== null ? Number(row.scorePercent) : "",
        row.passed === null ? "" : row.passed ? "Pass" : "Fail",
        row.createdAt.toISOString().slice(0, 10),
      ]);
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
