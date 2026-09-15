"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DuplicateBadge } from "@/components/DuplicateBadge";
import { StatusBadge } from "@/components/StatusBadge";

type TestRecordRow = {
  id: string;
  scanOrder: number;
  quizCode: string | null;
  bookTitle: string | null;
  studentNumber: string | null;
  resolvedTeacherFirstName: string | null;
  resolvedTeacherLastName: string | null;
  scorePercent: string | null;
  passed: boolean | null;
  gradingStatus: "clean" | "needs_grading_review" | "resolved";
  assignmentStatus: "clean" | "needs_assignment_review" | "resolved";
  isDuplicate: boolean;
};

export function BatchTestRecordsTable({ batchId, records }: { batchId: string; records: TestRecordRow[] }) {
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
    setSelected(checked ? new Set(records.map((r) => r.id)) : new Set());
  }

  const allSelected = records.length > 0 && selected.size === records.length;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <Button
            variant="destructive"
            onClick={() =>
              router.push(`/batches/${batchId}/bulk-delete?ids=${Array.from(selected).join(",")}`)
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
              <TableHead>#</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Student #</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={(c) => toggle(r.id, Boolean(c))}
                    aria-label={`Select scan ${r.scanOrder}`}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{r.scanOrder}</TableCell>
                <TableCell className="text-foreground">{r.bookTitle ?? r.quizCode ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">{r.studentNumber ?? "—"}</TableCell>
                <TableCell>
                  {r.resolvedTeacherFirstName ? `${r.resolvedTeacherFirstName} ${r.resolvedTeacherLastName}` : "—"}
                </TableCell>
                <TableCell>
                  {r.scorePercent !== null ? (
                    <span className={r.passed ? "text-foreground" : "font-medium text-destructive"}>
                      {Number(r.scorePercent).toFixed(0)}% {r.passed ? "" : "(fail)"}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge gradingStatus={r.gradingStatus} assignmentStatus={r.assignmentStatus} />
                    {r.isDuplicate && <DuplicateBadge />}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/batches/${batchId}/${r.id}/delete`}
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
