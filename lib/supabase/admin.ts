import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey } from "../env";

// Service-role client — bypasses RLS. Server-only (the "server-only" import
// above throws a build error if this is ever pulled into client code).
//
// This is what talks to the private scan-images bucket: since that bucket
// has no public access, every read/write/signed-URL request goes through
// this client from a Route Handler or Server Action, never the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseServiceRoleKey()!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
