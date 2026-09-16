import "server-only";
import { createClient } from "@/lib/supabase/server";

// Docs/8-Pivot-Addendum.md §9.3: one shared per-user daily cap across every
// route that calls the Claude API (process-image, pilot/compare-image,
// grading/test-read — confirmed one-pool-not-per-route with the user, since
// all three are reachable by any signed-in user with identical real cost
// per call). Wraps the increment_and_check_ai_usage() RPC
// (supabase/ai-usage-cap.sql), which does the actual atomic check —
// this function's only job is turning that into a friendly message, in one
// place, so the cap number can't drift out of sync between the check and
// the copy.
//
// Every caller places this check before its try block, ahead of any
// request-parsing/image-normalization/Claude work — meaning a slot is
// consumed on ADMISSION, not on success. Two consequences, not the same
// judgment call:
//   - A request that reaches readTestSheet() and fails there (Claude API
//     error, malformed response, no tool_use block) still consumes a slot —
//     deliberate. Anthropic bills a completed API call regardless of
//     whether the response parses cleanly on our side, so not counting
//     these would leave an uncapped path: repeatedly feeding ambiguous
//     images could burn real spend without ever tripping the cap.
//   - A request that fails before ever reaching Claude (missing image,
//     missing form field) also consumes a slot — a genuine, known
//     over-charge with no offsetting benefit, not something reasoned
//     through when this was designed. Left as-is: the client already
//     validates images before sending (lib/media/normalizeImage.ts's
//     tryNormalizeImageForUpload), so this is a narrow edge case, and
//     threading the check past request parsing just to avoid it isn't
//     worth the added complexity for a demo.
//
// What this cap actually protects against: per-account overuse, not
// determined abuse. Signup has no email/phone verification (Docs/8-Pivot-Addendum.md
// §9.2) and no rate-limiting on account creation, so nothing stops someone
// from creating unlimited accounts, each getting its own fresh 20/day. The
// real backstop against runaway cost is that the Anthropic API key runs on
// a prepaid balance with no card on file — worst case is that balance
// draining and the API failing closed, not an unbounded bill. This cap
// shapes normal demo usage; it is not the thing standing between this app
// and a large bill from a determined abuser.
//
// Self-host deployments (self-host Phase 1, Docs/8-Pivot-Addendum.md §7)
// skip this entirely — no artificial limit on a self-hoster's own paid key,
// and no point spending a DB round trip on a check that always passes.
export async function checkAndConsumeAiUsage(): Promise<{ allowed: boolean; message?: string }> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return { allowed: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_and_check_ai_usage").single<{
    allowed: boolean;
    currentCount: number;
    dailyCap: number;
  }>();

  if (error) {
    console.error("increment_and_check_ai_usage failed:", error);
    // Fails closed — a broken check should never mean "let the call through."
    return { allowed: false, message: "Couldn't verify today's usage limit. Try again in a moment." };
  }

  if (!data.allowed) {
    return {
      allowed: false,
      message: `Demo limit reached for today — you've used all ${data.dailyCap} of today's AI scans. This resets at midnight UTC. Thanks for trying QuizWhiz!`,
    };
  }

  return { allowed: true };
}
