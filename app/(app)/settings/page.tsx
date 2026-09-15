import { createClient } from "@/lib/supabase/server";
import { SmokeTestPanel } from "./SmokeTestPanel";

// Docs/2-App-Flow.md §4.10 / Docs/4-Content-Guidelines.md §6, updated per
// Docs/8-Pivot-Addendum.md §9.4. The original one-line version ("never
// student names... or other identifying information") stated a guarantee
// the app doesn't actually enforce — nothing stops a name from being typed
// into the student number field. That was true in practice in the
// single-school context this was written for (real ID numbers already
// existed independent of the app); it isn't true for a public signup with
// no such system behind it. Reworded as guidance, not a claim, and paired
// with the demo-status disclaimer the addendum asked for — this is the long
// form; app/signup/page.tsx carries a short version before signup.
const ABOUT_THIS_DEMO = [
  "QuizWhiz is a free portfolio demo, built to show real per-account data isolation working — not a committed, ongoing service. Your data is fully separated from every other account, but isn't guaranteed to persist; this demo may be reset or taken offline without notice.",
  "We store the email you signed up with, and whatever you type into the app — student numbers, teacher names, quiz codes and scores, and any answer keys you add. Please don't enter real student names or other identifying information anywhere; use made-up student numbers, the same way a real school uses ID numbers instead of names.",
];

export default async function SettingsPage() {
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
        <h2 className="text-sm font-semibold text-foreground">About this demo</h2>
        {ABOUT_THIS_DEMO.map((paragraph) => (
          <p key={paragraph} className="mt-2 text-sm text-muted-foreground first:mt-1">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Milestone-0 dev tool — burns a real AI-usage-cap slot per click and
          reads as internal jargon to a real demo visitor. Local-dev only,
          never shown in the deployed public demo (Docs/8-Pivot-Addendum.md
          §9.4 follow-up). Not deleted — still useful for the developer's own
          pipeline troubleshooting. */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4">
          <SmokeTestPanel />
        </div>
      )}
    </div>
  );
}
