import Link from "next/link";
import { isInstanceClaimed } from "@/lib/auth/instanceClaimed";
import { SignUpForm } from "./SignUpForm";

// Self-host deployments restrict to one owner (Docs/8-Pivot-Addendum.md
// §2-4, revisited) — the first real signup claims the instance, then this
// closes. The public demo (NEXT_PUBLIC_DEMO_MODE set) keeps signup open
// always; isInstanceClaimed() is never even called there. Same check is
// repeated in actions.ts's signUp() as defense in depth against a direct
// POST bypassing this page.
export default async function SignUpPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (!isDemoMode && (await isInstanceClaimed())) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">QuizWhiz</h1>
          <p className="mt-3 text-sm text-zinc-500">This instance already has an owner.</p>
          <p className="mt-6 text-sm text-zinc-500">
            <Link href="/login" className="font-medium text-zinc-900 hover:underline">
              Sign in
            </Link>{" "}
            instead.
          </p>
        </div>
      </div>
    );
  }

  return <SignUpForm isDemoMode={isDemoMode} />;
}
