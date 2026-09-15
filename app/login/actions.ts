"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

// Self-serve signup now exists (app/signup/, Docs/8-Pivot-Addendum.md §9.2) —
// this supersedes the original single-account-only decision (Docs/2-App-Flow.md
// §4.1). Any number of independent, RLS-isolated accounts can sign in here.
export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Outcome only — never log the password. Timestamped so attempts are easy
  // to correlate one-to-one during manual testing.
  console.log(
    `[login] ${new Date().toISOString()} email=${email} passwordLength=${password.length} result=${
      error ? `REJECTED (${error.message})` : "SUCCESS"
    }`
  );

  if (error) {
    return { error: "Couldn't sign in. Check your email and password and try again." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
