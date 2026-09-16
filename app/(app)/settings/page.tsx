import { createClient } from "@/lib/supabase/server";
import { SmokeTestPanel } from "./SmokeTestPanel";

// Docs/2-App-Flow.md §4.10 / Docs/4-Content-Guidelines.md §6, updated per
// Docs/8-Pivot-Addendum.md §9.4, then split again for self-host Phase 1
// (§7): this card is now the always-shown half (privacy guidance, genuinely
// mode-independent — not a demo-only thing) — the "not a committed
// service, may be reset" framing below is demo-only, since it would be
// actively wrong on a self-hoster's own real, persistent instance.
//
// The original one-line version ("never student names... or other
// identifying information") stated a guarantee the app doesn't actually
// enforce — nothing stops a name from being typed into the student number
// field. That was true in practice in the single-school context this was
// written for (real ID numbers already existed independent of the app); it
// isn't true for open signup with no such system behind it. Worded as
// guidance, not a claim.
const PRIVACY_NOTE =
  "QuizWhiz stores the email you signed up with, and whatever you type into the app — student numbers, teacher names, quiz codes and scores, and any answer keys you add. Please don't enter real student names or other identifying information anywhere; use made-up student numbers, the same way a real school uses ID numbers instead of names.";

const DEMO_DISCLAIMER =
  "This is a free portfolio demo, built to show real per-account data isolation working — not a committed, ongoing service. Your data is fully separated from every other account, but isn't guaranteed to persist; this demo may be reset or taken offline without notice.";

export default async function SettingsPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">What QuizWhiz stores</h2>
        <p className="mt-1 text-sm text-muted-foreground">{PRIVACY_NOTE}</p>
      </div>

      {isDemoMode && (
        <div className="mt-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">About this demo</h2>
          <p className="mt-1 text-sm text-muted-foreground">{DEMO_DISCLAIMER}</p>
        </div>
      )}

      {/* Milestone-0 dev tool — burns a real AI-usage-cap slot per click and
          reads as internal jargon to a real demo visitor. Local-dev only,
          never shown in any deployed instance, demo or self-host
          (Docs/8-Pivot-Addendum.md §9.4 follow-up). Not deleted — still
          useful for the developer's own pipeline troubleshooting. */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4">
          <SmokeTestPanel />
        </div>
      )}
    </div>
  );
}
