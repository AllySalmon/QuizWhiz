"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Teacher = { id: string; firstName: string; lastName: string; studentCount: number };

export function TeachersTable({ teachers }: { teachers: Teacher[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(teachers.map((t) => t.id)) : new Set());
  }

  const allSelected = teachers.length > 0 && selected.size === teachers.length;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <Button
            variant="destructive"
            onClick={() => router.push(`/roster/teachers/bulk-delete?ids=${Array.from(selected).join(",")}`)}
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
              <TableHead>Name</TableHead>
              <TableHead>Students</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(teacher.id)}
                    onCheckedChange={(c) => toggle(teacher.id, Boolean(c))}
                    aria-label={`Select ${teacher.firstName} ${teacher.lastName}`}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/roster/teachers/${teacher.id}`} className="font-medium text-foreground hover:underline">
                    {teacher.firstName} {teacher.lastName}
                  </Link>
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
    </div>
  );
}
