import Link from "next/link";
import { listStudents } from "@/lib/db/queries/studentRoster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RosterTabs } from "../RosterTabs";
import { CsvImportForm } from "./CsvImportForm";

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const students = await listStudents(q);

  return (
    <div>
      <RosterTabs active="students" />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
        <Button render={<Link href="/roster/students/new">Add student</Link>} />
      </div>

      <div className="mt-4">
        <CsvImportForm />
      </div>

      <form className="mt-6" action="/roster/students">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by student number or teacher last name"
        />
      </form>

      {students.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {q ? "No students match that search." : "No students yet. Import a roster CSV to get started."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student number</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Grade band</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.studentNumber}>
                  <TableCell className="font-mono text-sm">{student.studentNumber}</TableCell>
                  <TableCell>
                    {student.teacherFirstName
                      ? `${student.teacherFirstName} ${student.teacherLastName}`
                      : "—"}
                  </TableCell>
                  <TableCell>{GRADE_BAND_LABEL[student.gradeBand]}</TableCell>
                  <TableCell className="flex justify-end gap-4 text-right">
                    <Link
                      href={`/roster/students/${student.studentNumber}/edit`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/roster/students/${student.studentNumber}/delete`}
                      className="text-sm font-medium text-destructive hover:underline"
                    >
                      Delete
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
