import { NextResponse } from "next/server";
import { sweepExpiredScanImages } from "@/lib/db/queries/scanImageRetention";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron invocation (vercel.json) — Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Fails closed if CRON_SECRET isn't configured at all, matching Vercel's
// own documented pattern, rather than leaving this open to anyone who
// finds the URL.
//
// Hobby plan (both the live demo and self-host deployments) caps cron jobs
// at once/day with up to ±59min timing slop — see
// lib/db/queries/scanImageRetention.ts for why a daily sweep, not instant
// deletion, is the real retention mechanism now.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await sweepExpiredScanImages();
  return NextResponse.json({ ok: true, deleted });
}
