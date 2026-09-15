import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TeacherReportGroup } from "@/lib/db/queries/testRecords";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666666", marginBottom: 16 },
  teacherHeading: { fontSize: 12, marginTop: 16, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingVertical: 4 },
  headerCell: { fontFamily: "Helvetica-Bold" },
  colStudent: { width: "18%" },
  colBook: { width: "34%" },
  colScore: { width: "14%" },
  colResult: { width: "14%" },
  colDate: { width: "20%" },
  fail: { color: "#b91c1c" },
});

// Same grouped-by-teacher structure as the xlsx export (lib/reports/buildWorkbook.ts),
// rendered as an actual document instead of a spreadsheet — chosen over
// pdf-lib specifically because this is a multi-section layout, not a
// single fixed page (see the approved Milestone 2 plan).
export function ReportDocument({
  batchLabel,
  groups,
}: {
  batchLabel: string;
  groups: TeacherReportGroup[];
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{batchLabel}</Text>
        <Text style={styles.subtitle}>SSYRA Quiz Report</Text>

        {groups.map((group) => (
          <View key={group.teacherId} wrap={false}>
            <Text style={styles.teacherHeading}>
              {group.teacherFirstName} {group.teacherLastName}
            </Text>
            <View style={styles.headerRow}>
              <Text style={[styles.colStudent, styles.headerCell]}>Student #</Text>
              <Text style={[styles.colBook, styles.headerCell]}>Book</Text>
              <Text style={[styles.colScore, styles.headerCell]}>Score</Text>
              <Text style={[styles.colResult, styles.headerCell]}>Result</Text>
              <Text style={[styles.colDate, styles.headerCell]}>Date Tested</Text>
            </View>
            {group.rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.colStudent}>{row.studentNumber ?? "—"}</Text>
                <Text style={styles.colBook}>{row.bookTitle ?? row.quizCode ?? "—"}</Text>
                <Text style={styles.colScore}>
                  {row.scorePercent !== null ? `${Number(row.scorePercent).toFixed(0)}%` : "—"}
                </Text>
                <Text style={[styles.colResult, row.passed === false ? styles.fail : undefined]}>
                  {row.passed === null ? "—" : row.passed ? "Pass" : "Fail"}
                </Text>
                <Text style={styles.colDate}>{new Date(row.createdAt).toISOString().slice(0, 10)}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
