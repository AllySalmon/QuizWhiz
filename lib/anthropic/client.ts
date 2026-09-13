import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient() {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.");
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

// Tunable independently of the SDK/client above — expect this to change
// during the Milestone 1 accuracy pilot (Docs/6-Implementation-Plan.md §3).
export const GRADING_MODEL = process.env.ANTHROPIC_GRADING_MODEL ?? "claude-sonnet-5";
