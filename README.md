# QuizWhiz

Scan a stack of paper multiple-choice reading quizzes, get instant AI-assisted grading and per-teacher reports. Built originally for a school librarian's SSYRA reading-quiz program; broadened to a general "grade circled-answer tests" tool for homeschool parents, classroom teachers, and coaches. See `Docs/` for the full product spec — `Docs/1-PRD.md` and `Docs/8-Pivot-Addendum.md` are the source of truth if anything here ever seems to conflict with them.

**Live demo:** [quizwhiz-ashen.vercel.app](https://quizwhiz-ashen.vercel.app) — public, signed-up accounts are fully isolated from each other, but this is a portfolio demo, not a persistent service.

## Deploy your own instance

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAllySalmon%2FQuizWhiz&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key%2C%20used%20to%20read%20and%20grade%20scanned%20tests.%20Get%20one%20at%20console.anthropic.com.&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&project-name=quizwhiz&repository-name=quizwhiz&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%7D%5D)

This is the fast path for a real, single-tenant deployment of your own — it provisions a fresh Supabase project automatically via Vercel's native Supabase integration, and runs the full database migration and storage bucket setup on first build (`scripts/setup-database.ts`) — no manual SQL, no CLI migration command. The one thing that can't be automated is your own [Anthropic API key](https://console.anthropic.com/settings/keys), which you'll be prompted for during the deploy flow.

Every deployment is single-tenant: the first person to sign in claims the instance as its owner, and signup closes after that. This is separate from the public demo above, which stays open to anyone. A full step-by-step guide with screenshots, for a non-technical reader, is planned as a later addition — for now, this button plus the manual walkthrough below (if you want to understand what it's doing, or run it locally instead) are the available paths.

## Manual / local development setup

Useful if you're contributing to the codebase itself, rather than just deploying your own instance — the button above does all of this for you automatically.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (Postgres + Auth + Storage, free tier).
2. Project Settings → API: copy the Project URL and the `anon` public key.
3. Project Settings → API: copy the `service_role` key (server-only, never expose this to the browser).
4. Project Settings → Database → Connect: **do not use the "Direct connection" tab** — that host (`db.<ref>.supabase.co`) is IPv6-only unless you pay for the IPv4 add-on, and fails with `ENOTFOUND` on most networks. Use the **Transaction pooler** and **Session pooler** tabs instead (both route through `aws-0-<region>.pooler.supabase.com` with username `postgres.<project-ref>`, which is IPv4-compatible).
5. Paste everything into `.env.local` (copy `.env.local.example` first) — Transaction pooler goes in `DATABASE_URL` (app runtime), Session pooler goes in `DIRECT_URL` (migrations only; see `drizzle.config.ts` for why they're split).

### 2. Database schema, RLS, and storage bucket

```bash
npm run build
```

`scripts/setup-database.ts` runs automatically before `next build` — it applies every Drizzle migration in `lib/db/migrations/`, creates the private `scan-images` storage bucket (`public = false`; all access goes through the service-role client in `lib/supabase/admin.ts`, never the browser directly), and applies the RLS policies and RPC functions under `supabase/*.sql`. Safe to run repeatedly — it detects an already-configured database and exits immediately. Re-run `npm run db:generate` after editing `lib/db/schema.ts` to produce a new migration first.

For local iteration without a full build, `npm run db:migrate` applies just the Drizzle migrations on their own.

### 3. Your own account

Start the app (`npm run dev`) and sign up through `/signup` with your own email — the first real signup on a fresh instance becomes its owner, and signup closes after that (see `lib/auth/instanceClaimed.ts`).

### 4. Anthropic API key

Get a key from the [Anthropic Console](https://console.anthropic.com) and add it to `.env.local` as `ANTHROPIC_API_KEY`.

### 5. Vercel (optional, for deploying your local changes)

Connect this repo at [vercel.com/new](https://vercel.com/new), then add the same environment variables from `.env.local` in the Vercel project settings — or use the native Supabase integration and let `lib/env.ts` resolve its variable names automatically.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login` (or `/signup` if the instance isn't claimed yet).

## Other commands

```bash
npm run lint        # ESLint
npx tsc --noEmit     # Type-check
npm run db:studio    # Drizzle Studio (browse the DB)
```
