"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = { error: null };

export function SignUpForm({ isDemoMode }: { isDemoMode: boolean }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/quizwhiz-full-logo.png" alt="QuizWhiz" width={210} height={171} priority />
          <p className="mt-1 text-sm text-zinc-500">Create an account to get started.</p>
        </div>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Password
            </label>
            <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Sign in
          </Link>
        </p>

        {/* Docs/8-Pivot-Addendum.md §9.4 — demo-only disclaimer. Self-host
            deployments don't show this at all (app/signup/page.tsx only
            renders this component with isDemoMode when NEXT_PUBLIC_DEMO_MODE
            is set) — it would be actively wrong on a real librarian's own
            persistent instance. */}
        {isDemoMode && (
          <p className="mt-4 text-center text-xs text-zinc-400">
            QuizWhiz is a free portfolio demo, not a committed ongoing service — data isn&apos;t
            guaranteed to persist. We store the email you sign up with and whatever you type into
            the app.
          </p>
        )}
      </div>
    </div>
  );
}
