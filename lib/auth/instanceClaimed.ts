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
export async function isInstanceClaimed() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
  return data.users.length > 0;
}
