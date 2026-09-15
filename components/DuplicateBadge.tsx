import { Copy } from "lucide-react";

// Advisory, not an error — a re-scan can be a genuine retake, so this uses
// neutral styling (not text-destructive) even though it still pairs an
// icon with text, never color alone (Docs/4-Content-Guidelines.md §5).
// Shared across every list that surfaces test records (batch table, Graded
// Today, both review queues) since lib/db/queries/testRecords.ts computes
// `isDuplicate` on all of them via the shared queueSelection.
export function DuplicateBadge() {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Copy className="size-3" aria-hidden />
      Possible duplicate — same student &amp; quiz code as another scan
    </span>
  );
}
