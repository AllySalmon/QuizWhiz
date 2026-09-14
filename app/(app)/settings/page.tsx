import { createClient } from "@/lib/supabase/server";
import { SmokeTestPanel } from "./SmokeTestPanel";

// Docs/2-App-Flow.md §4.10 / Docs/4-Content-Guidelines.md §6.
const PRIVACY_NOTE =
  "QuizWhiz stores student numbers and quiz scores only — never student names, photos of students, or other identifying information.";

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
        <h2 className="text-sm font-semibold text-foreground">What QuizWhiz stores</h2>
        <p className="mt-1 text-sm text-muted-foreground">{PRIVACY_NOTE}</p>
      </div>

      <div className="mt-4">
        <SmokeTestPanel />
      </div>
    </div>
  );
}
