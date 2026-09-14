import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan & Upload" },
  { href: "/batches", label: "Scan History" },
  { href: "/review/grading", label: "Review" },
  { href: "/answer-keys", label: "Answer Keys" },
  { href: "/roster/teachers", label: "Roster" },
  { href: "/pilot", label: "Accuracy Check" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        {/* The header isn't constrained to max-w-5xl like the main content —
            that width is for comfortable reading, not for a nav bar with 8+
            items; capping it there was what forced wrapping regardless of
            how much room the actual window had. max-w-7xl gives it real
            room to sit on one line on a normal desktop window. flex-wrap
            stays on as a fallback only (narrow windows, phone width) so it
            degrades to wrapping instead of clipping/scrolling, rather than
            being the expected everyday look. whitespace-nowrap keeps each
            label from breaking mid-word if that fallback ever kicks in. The
            account group uses ml-auto (not justify-between on the outer
            container) so it stays right-aligned in both cases. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm font-semibold whitespace-nowrap text-foreground">QuizWhiz</span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center gap-3 whitespace-nowrap">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
