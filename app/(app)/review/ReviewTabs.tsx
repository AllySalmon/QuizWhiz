import Link from "next/link";
import { cn } from "@/lib/utils";

// Two related but distinct problems (Docs/1-PRD.md §5.5) — same tab pattern
// as Roster's Teachers/Students (app/(app)/roster/RosterTabs.tsx).
export function ReviewTabs({
  active,
  batchId,
}: {
  active: "grading" | "assignment";
  batchId?: string;
}) {
  const suffix = batchId ? `?batch=${batchId}` : "";
  const tabs = [
    { id: "grading", label: "Grading Review", href: `/review/grading${suffix}` },
    { id: "assignment", label: "Needs Review (Assignment)", href: `/review/assignment${suffix}` },
  ] as const;

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
