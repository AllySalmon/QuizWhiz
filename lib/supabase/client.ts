import { createBrowserClient } from "@supabase/ssr";

// Browser client — safe to use the anon key here, RLS protects the data.
// There's exactly one login (the librarian), so no roles/permissions logic needed.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
