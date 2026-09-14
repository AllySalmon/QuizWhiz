import Link from "next/link";
import { listTeachersWithStudentCounts } from "@/lib/db/queries/teachers";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RosterTabs } from "../RosterTabs";
import { CsvImportForm } from "./CsvImportForm";

export default async function TeachersPage() {
  const teachers = await listTeachersWithStudentCounts();

  return (
    <div>
      <RosterTabs active="teachers" />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Teachers</h1>
        <Button render={<Link href="/roster/teachers/new">Add teacher</Link>} />
      </div>

      <div className="mt-4">
        <CsvImportForm />
      </div>

      {teachers.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No teachers yet. Add every teacher from the school&apos;s staff list before importing students.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Students</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium text-foreground">
                    {teacher.firstName} {teacher.lastName}
                  </TableCell>
                  <TableCell>{teacher.studentCount}</TableCell>
                  <TableCell className="flex justify-end gap-4 text-right">
                    <Link
                      href={`/roster/teachers/${teacher.id}/edit`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Rename
                    </Link>
                    <Link
                      href={`/roster/teachers/${teacher.id}/delete`}
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
