# QuizWhiz

SSYRA reading-quiz grading tool for the school librarian. See `Docs/` for the
full product spec — `Docs/1-PRD.md` is the source of truth if anything here
ever seems to conflict with it.

## Status

Milestone 0 (infra scaffold) — see `Docs/6-Implementation-Plan.md` §2.

## One-time setup (steps that need your own credentials)

These can't be scripted — they need your Supabase/Anthropic/Vercel accounts.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (Postgres + Auth + Storage, free tier).
2. Project Settings → API: copy the Project URL and the `anon` public key.
3. Project Settings → API: copy the `service_role` key (server-only, never expose this to the browser).
4. Project Settings → Database → Connection string: copy both the **pooled** (transaction mode, port 6543) and **direct** (port 5432) connection strings.
5. Paste all five into `.env.local` (copy `.env.local.example` first) — pooled goes in `DATABASE_URL` (app runtime), direct goes in `DIRECT_URL` (migrations only; see `drizzle.config.ts` for why they're split).

### 2. Database schema

```bash
npm run db:migrate
```

This applies `lib/db/migrations/0000_*.sql` (generated from `lib/db/schema.ts`,
which mirrors `Docs/5-Backend-Schema.md`). Re-run `npm run db:generate` after
editing `lib/db/schema.ts` to produce a new migration.

### 3. Storage bucket (private)

In the Supabase SQL editor, run `supabase/storage-setup.sql`. This creates
the `scan-images` bucket with `public = false` — per project decision, scan
images are **never** publicly accessible. All access goes through the
service-role client (`lib/supabase/admin.ts`) from server code only; the
browser client never touches this bucket directly.

### 4. Dev/test login

Supabase dashboard → Authentication → Users → Add user. **Use your own email
for all Milestone 0/1 development and testing** — the librarian's real
account isn't provisioned until we're ready for the soft launch
(`Docs/6-Implementation-Plan.md` §5).

### 5. Anthropic API key

Get a key from the [Anthropic Console](https://console.anthropic.com) and
add it to `.env.local` as `ANTHROPIC_API_KEY`.

### 6. Vercel (optional for local dev)

Connect this repo at [vercel.com/new](https://vercel.com/new), then add the
same environment variables from `.env.local` in the Vercel project settings.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/login`. Sign in with the dev account from step 4 above, then use the
**"Run smoke test"** button on the home page to confirm the Claude vision
pipeline works end to end (Milestone 0 exit criteria).

The smoke test currently sends a blank placeholder image (no real scanned
test sheet exists yet) — expect every field to come back null/low-confidence.
That's correct for now; it's testing the pipeline, not read accuracy. Swap
in a real scan later via the "image" field on `POST /api/grading/test-read`,
or by replacing `public/sample-test-sheet-placeholder.png`.

## Other commands

```bash
npm run lint        # ESLint
npx tsc --noEmit     # Type-check
npm run db:studio    # Drizzle Studio (browse the DB)
```
