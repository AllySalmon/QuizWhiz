import Link from "next/link";
import { cn } from "@/lib/utils";

export function RosterTabs({ active }: { active: "teachers" | "students" }) {
  const tabs = [
    { id: "teachers", label: "Teachers", href: "/roster/teachers" },
    { id: "students", label: "Students", href: "/roster/students" },
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
