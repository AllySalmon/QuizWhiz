import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeacher, getStudentsForTeacher } from "@/lib/db/queries/teachers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RosterTabs } from "../../RosterTabs";

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

export default async function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [teacher, students] = await Promise.all([getTeacher(id), getStudentsForTeacher(id)]);
  if (!teacher) notFound();

  return (
    <div>
      <RosterTabs active="teachers" />

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {teacher.firstName} {teacher.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.length} student{students.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link href={`/roster/teachers/${id}/edit`} className="text-sm font-medium text-primary hover:underline">
            Rename
          </Link>
          <Link href={`/roster/teachers/${id}/delete`} className="text-sm font-medium text-destructive hover:underline">
            Delete
          </Link>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No students assigned to this teacher.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student number</TableHead>
                <TableHead>Grade band</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.studentNumber}>
                  <TableCell className="font-mono text-sm">
                    <Link href={`/students/${student.studentNumber}`} className="hover:underline">
                      {student.studentNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{GRADE_BAND_LABEL[student.gradeBand]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
