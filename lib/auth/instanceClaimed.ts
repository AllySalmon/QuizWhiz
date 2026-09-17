import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Self-host signup restriction (Docs/8-Pivot-Addendum.md §2-4, revisited):
// a fresh self-host deployment should behave like the original "single
// account, provisioned once" design, not the public demo's open signup.
// The first real signUp() claims the instance; after that, /signup closes.
//
// Checked via auth.admin.listUsers() (the admin/service-role client,
// already used for storage) rather than a new table — auth.users isn't
// reachable through the RLS-respecting client at all (not exposed via
// PostgREST, and an anonymous visitor has no session to scope RLS by
// anyway), and a dedicated table would be pure overhead for one global
// boolean nothing else needs. Only ever called when NEXT_PUBLIC_DEMO_MODE
// is off — see app/signup/page.tsx and app/signup/actions.ts.
//
// Checks for a CONFIRMED user specifically, not just any row — found live,
// the hard way, during this feature's own first real test: a fresh
// Supabase project defaults to "Confirm email" on, which this app's design
// doesn't account for (no email-verification flow exists at all — see
// app/signup/actions.ts). signUp() still inserts the auth.users row even
// when it can't return a session, so the original "any row exists" check
// let a single failed/unconfirmed attempt permanently lock the instance
// out — nobody, including the real owner, could ever sign up again,
// regardless of whether "Confirm email" gets turned off afterward. Two
// unrelated people hit this independently on the same test deployment
// before it was caught. perPage is generously above 1 (a single owner
// realistically never approaches this) so an unconfirmed row occupying the
// first page slot can't hide a real confirmed user behind it.
export async function isInstanceClaimed() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  return data.users.some((u) => u.email_confirmed_at != null);
}
