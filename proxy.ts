import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/cron is excluded deliberately: Vercel's cron invocation
  // (app/api/cron/cleanup-scan-images) carries no Supabase session cookie,
  // and this proxy redirects any unauthenticated request to /login — Vercel
  // does not follow redirects from a cron-triggered endpoint, so without
  // this exclusion the daily sweep would silently never run. That route
  // verifies CRON_SECRET itself instead (see its own file).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
