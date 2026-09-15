"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";

type DuplicateRow = {
  id: string;
  batchId: string;
  studentNumber: string | null;
  bookTitle: string | null;
  quizCode: string | null;
  scorePercent: string | null;
  passed: boolean | null;
  gradingStatus: "clean" | "needs_grading_review" | "resolved";
  assignmentStatus: "clean" | "needs_assignment_review" | "resolved";
  createdAt: string;
};

type DuplicateGroup = {
  key: string;
  bookLabel: string;
  studentNumber: string;
  rows: DuplicateRow[];
};

// Same checkbox + selection + "Delete selected" pattern as
// BatchTestRecordsTable.tsx (and Roster's student/teacher tables) — one
// selection Set shared across every group's table, since a duplicate set
// can span multiple batches. Routes to /duplicates/bulk-delete instead of
// a batch-scoped bulk-delete, since there's no single batch to redirect
// back to.
export function DuplicatesTable({ groups }: { groups: DuplicateGroup[] }) {
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

  function toggleGroup(rows: DuplicateRow[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <Button
            variant="destructive"
            onClick={() => router.push(`/duplicates/bulk-delete?ids=${Array.from(selected).join(",")}`)}
          >
            Delete selected
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((group) => {
          const groupSelected = group.rows.length > 0 && group.rows.every((r) => selected.has(r.id));
          return (
            <div key={group.key}>
              <h2 className="text-sm font-semibold text-foreground">
                {group.bookLabel} — student{" "}
                <Link href={`/students/${group.studentNumber}`} className="text-primary hover:underline">
                  {group.studentNumber}
                </Link>
              </h2>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={groupSelected}
                          onCheckedChange={(c) => toggleGroup(group.rows, Boolean(c))}
                          aria-label={`Select all for ${group.bookLabel} — student ${group.studentNumber}`}
                        />
                      </TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scanned</TableHead>
                      <TableHead>Batch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={(c) => toggle(r.id, Boolean(c))}
                            aria-label={`Select scan for student ${r.studentNumber}`}
                          />
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
                          <StatusBadge gradingStatus={r.gradingStatus} assignmentStatus={r.assignmentStatus} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString(undefined, {
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/batches/${r.batchId}`} className="text-sm font-medium text-primary hover:underline">
                            View batch
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
