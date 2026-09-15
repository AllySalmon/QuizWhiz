"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignUpState = { error: string | null };

const MIN_PASSWORD_LENGTH = 8;

// Real self-serve signup (Docs/8-Pivot-Addendum.md §9.2) — supersedes the
// single-account-only decision this app started with (Docs/2-App-Flow.md
// §4.1). No email/phone verification for this phase: requires "Confirm
// email" to be off for the Email provider in the Supabase dashboard, or
// signUp() below won't return a session and this redirect never fires.
export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  // Outcome only — never log the password. Timestamped so attempts are easy
  // to correlate one-to-one during manual testing (same convention as
  // app/login/actions.ts's signIn).
  console.log(
    `[signup] ${new Date().toISOString()} email=${email} passwordLength=${password.length} result=${
      error ? `REJECTED (${error.message})` : "SUCCESS"
    }`
  );

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { error: "An account with that email already exists — try signing in instead." };
    }
    return { error: "Couldn't create your account. Check your details and try again." };
  }

  if (!data.session) {
    // Only reachable if "Confirm email" is still on for the Email provider —
    // signUp() then returns a user with no session. Not the designed path
    // for this phase (see file header), but fails honestly instead of
    // silently redirecting into a session that doesn't exist.
    return {
      error: "Your account was created, but couldn't sign you in automatically. Try signing in.",
    };
  }

  redirect("/");
}
