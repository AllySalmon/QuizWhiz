import Link from "next/link";
import { listTeachersWithStudentCounts } from "@/lib/db/queries/teachers";
import { Button } from "@/components/ui/button";
import { RosterTabs } from "../RosterTabs";
import { CsvImportForm } from "./CsvImportForm";
import { TeachersTable } from "./TeachersTable";

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
        <div className="mt-6">
          <TeachersTable teachers={teachers} />
        </div>
      )}
    </div>
  );
}
