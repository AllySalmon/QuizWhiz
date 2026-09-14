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
        {/* True 3-part header via grid (auto | 1fr | auto): logo takes only
            the width it needs on the left, account info the same on the
            right, and nav centers in whatever space is left between them —
            not just "centered within an equal third," which flex-1 on all
            three would give and wouldn't actually center relative to the
            row when logo/account aren't the same width. flex-wrap on nav
            is a narrow-viewport fallback only; whitespace-nowrap keeps
            labels from breaking mid-word if that ever kicks in. */}
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-x-4 px-6 py-4">
          <span className="text-sm font-semibold whitespace-nowrap text-foreground">QuizWhiz</span>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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

          <div className="flex items-center gap-3 whitespace-nowrap">
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
