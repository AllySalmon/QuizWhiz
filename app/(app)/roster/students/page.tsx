import Link from "next/link";
import { listStudents } from "@/lib/db/queries/studentRoster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RosterTabs } from "../RosterTabs";
import { CsvImportForm } from "./CsvImportForm";
import { StudentsTable } from "./StudentsTable";

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
        <div className="mt-4">
          <StudentsTable students={students} />
        </div>
      )}
    </div>
  );
}
