# Tech Stack
## QuizWhiz

**Companion to:** QuizWhiz-PRD.md, QuizWhiz-AppFlow.md
**Version:** 0.1 (Draft)

---

## 1. Constraints That Shape This Stack

- **Single user** (the librarian) — no need for complex multi-tenant auth or roles.
- **No school IT/OCPS integration** — this runs independently; nothing here needs district approval or district infrastructure.
- **No budget** — the whole project exists *because* the school lost funding for Renaissance. Every choice below favors free-tier or low-cost services over anything with real licensing cost.
- **Web + mobile from one codebase** — avoids building and maintaining two separate apps.
- **Variable, bursty load** — batches of 10 to 200 images, arriving unpredictably through the day, not a steady drip. The stack needs to handle a 200-image batch without falling over, but doesn't need to run hot 24/7.
- **AI-based grading is the core feature** — the stack needs a reliable way to read a photographed answer sheet (circled letters + handwritten numbers/name) and return structured, checkable data.

## 2. Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (web) | **Next.js (React) + TypeScript** | One codebase serves both the web app and (via PWA, see Mobile doc) the phone experience. Strong ecosystem, easy to host cheaply. |
| Styling | **Tailwind CSS**, shadcn/ui components | Matches the "clean, spacious, Apple-style" design direction without hand-building a design system from scratch. |
| Backend | **Next.js API routes / serverless functions (TypeScript)** | Keeps the whole app as one deployable project — simpler for a small, single-maintainer build than a separate backend service. |
| Database | **PostgreSQL** (hosted via Supabase) | Relational fits this data well (teachers ↔ students ↔ test records ↔ book reports all have real relationships). Supabase bundles Postgres + Auth + Storage in one free-tier-friendly package. |
| Auth | **Supabase Auth** (email + password, single account) | Off-the-shelf, secure, no need to build auth from scratch for one user. |
| File/image storage | **Supabase Storage** | Stores scan images only as long as the retention policy requires (see PRD Section 6), then auto-deletes. |
| AI grading engine | **Claude (Anthropic API), vision-capable model** | Given a photo of a test sheet plus the relevant answer key, Claude reads the quiz code, student number, teacher last name, and each circled answer, and returns structured JSON (including a confidence signal used to decide Grading Review vs. clean pass). This is the core "AI-powered" piece of the app. |
| CSV import/export | **PapaParse** (roster import), **SheetJS/xlsx** (report export) | Well-supported libraries for the spreadsheet in/out points. |
| PDF export | **pdf-lib** or a hosted HTML-to-PDF step | For the printable/forwardable per-teacher reports. |
| Hosting | **Vercel** (app) + **Supabase** (data/storage/auth) | Both have generous free tiers appropriate to this scale (one user, a few hundred requests a day even at peak batch volume). |
| Notifications (optional, Phase 2+) | **Web Push** (for the escalation alerts on mobile) | See Mobile Implementation doc. |

## 3. How Grading Actually Works (High-Level)

1. Librarian uploads a batch (photos or PDF pages).
2. Each page/photo is split into an individual test image.
3. For each image, the app makes **one call** to Claude with:
   - The image
   - A structured-output instruction: return JSON with quiz code, student number, teacher last name, per-question selected answer, and a confidence flag for each field
   (Note: the answer key is *not* needed for this call — Claude's job is reading the sheet, not grading it. Scoring happens afterward, in QuizWhiz's own code, once the quiz code identifies which key to check against.)
4. The app looks up the answer key by the returned quiz code:
   - **No match found** (unreadable or unrecognized quiz code) → the test cannot be scored at all; it routes to Grading Review with a null score and a distinct flag, since there's no key to grade against.
   - **Match found** → the app computes the score from the returned answers vs. the stored key (grading logic lives in QuizWhiz's own code, not left to the model — the model's job is *reading* the sheet, not deciding pass/fail).
5. Based on confidence flags: clean tests are saved directly; anything below threshold on the *answer marks* goes to Grading Review; anything below threshold (or contradicting the roster) on *student number / teacher* goes to Needs Review (Assignment).
6. Once resolved (automatically or via her review), the record's status updates and it becomes eligible for teacher-grouped reporting.

## 4. Why Not Traditional OCR / Bubble-Sheet Software?

Purpose-built bubble-sheet scanners (like the old Scantron machines) need precisely printed forms and dedicated hardware — not a fit here, since the existing paper format isn't a printed bubble sheet and there's no scanner hardware budget. A vision-capable LLM handles handwriting and loosely-circled letters without needing a rigid template, which matches "grade the format already in use" (PRD Decision #1). The trade-off is per-image API cost and the need for a solid confidence/review-queue design — which is why that queue is a first-class feature, not an afterthought.

## 5. Cost Shape (Rough, for Planning)

- Supabase and Vercel: free tier very likely covers this scale (one user, low request volume, modest storage since images are deleted after grading).
- Claude API: the main recurring cost, scaling with number of tests graded (~900 students × several tests/year). Worth estimating actual per-image cost during the Phase 1 pilot before committing to full rollout, and worth checking Anthropic's current API pricing at that time since it may have changed.
- No other paid services required for v1.

## 6. What This Stack Deliberately Avoids

- No native iOS/Android app (App Store review, developer accounts, two codebases) — see Mobile Implementation doc for the PWA rationale.
- No multi-tenant user system, roles/permissions engine, or SSO — there's exactly one login.
- No integration with OCPS/district systems — everything here is self-contained, per the PRD.

---

*Next: Content Guidelines, then Backend Schema (the actual data model behind this stack).*
