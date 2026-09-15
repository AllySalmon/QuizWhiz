"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

type Student = {
  studentNumber: string;
  gradeBand: "jr" | "3-5";
  teacherId: string | null;
  teacherFirstName: string | null;
  teacherLastName: string | null;
};

export function StudentsTable({ students }: { students: Student[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(studentNumber: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentNumber);
      else next.delete(studentNumber);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(students.map((s) => s.studentNumber)) : new Set());
  }

  const allSelected = students.length > 0 && selected.size === students.length;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <Button
            variant="destructive"
            onClick={() =>
              router.push(`/roster/students/bulk-delete?ids=${Array.from(selected).join(",")}`)
            }
          >
            Delete selected
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(Boolean(c))} aria-label="Select all" />
              </TableHead>
              <TableHead>Student number</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Grade band</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.studentNumber}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(student.studentNumber)}
                    onCheckedChange={(c) => toggle(student.studentNumber, Boolean(c))}
                    aria-label={`Select student ${student.studentNumber}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <Link href={`/students/${student.studentNumber}`} className="hover:underline">
                    {student.studentNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {student.teacherFirstName ? `${student.teacherFirstName} ${student.teacherLastName}` : "—"}
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
    </div>
  );
}
