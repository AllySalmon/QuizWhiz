// Shared across every list that shows a test record's resolution state
// (batch table, Graded Today, Possible Duplicates) — was duplicated
// verbatim in two places before this extraction.
export function StatusBadge({
  gradingStatus,
  assignmentStatus,
}: {
  gradingStatus: "clean" | "needs_grading_review" | "resolved";
  assignmentStatus: "clean" | "needs_assignment_review" | "resolved";
}) {
  if (gradingStatus === "needs_grading_review") {
    return <span className="text-sm text-destructive">Needs grading review</span>;
  }
  if (assignmentStatus === "needs_assignment_review") {
    return <span className="text-sm text-destructive">Needs assignment review</span>;
  }
  const wasReviewed = gradingStatus === "resolved" || assignmentStatus === "resolved";
  return <span className="text-sm text-muted-foreground">{wasReviewed ? "Resolved" : "Clean"}</span>;
}
