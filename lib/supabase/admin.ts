import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Server-only (the "server-only" import
// above throws a build error if this is ever pulled into client code).
//
// This is what talks to the private scan-images bucket: since that bucket
// has no public access, every read/write/signed-URL request goes through
// this client from a Route Handler or Server Action, never the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
