# Implementation Plan
## QuizWhiz

**Companion to:** all prior QuizWhiz documents
**Version:** 0.1 (Draft)

---

## 1. Approach

This is a small, single-maintainer build for a single user, so the plan favors **working software early and a real pilot before trusting it with all 900 students**, over a long up-front build. Timeframes below are relative (Week 1, Week 2...) rather than fixed calendar dates, since this depends on your available time.

## 2. Milestone 0 — Setup (≈1 week)

- Stand up hosting/infra: Vercel project, Supabase project (Postgres + Auth + Storage).
- Create the database from the Backend Schema doc.
- Get Anthropic API access configured and test a basic vision call against a sample scanned test image.
- Create the librarian's single login.

**Exit criteria:** you can log in, and a test image can be sent to Claude and get a structured response back — even if nothing else is built yet.

## 3. Milestone 1 — Phase 1 Core (≈2–3 weeks)

Scope, per the PRD's phasing:
- Answer Key management (add/edit a quiz code + its correct answers)
- Roster management: Teachers (add/edit/delete-with-reassignment) and Student roster (CSV import + one-by-one)
- **First-time setup checklist** on the Home dashboard (see App Flow Section 2) — guides the librarian through Answer Keys → Teachers → Student Roster before "Scan & Upload" becomes the primary action, so the very first real batch doesn't flood the review queues unnecessarily
- Single-batch upload → grading → both review queues, for **one grade band only** (recommend starting with whichever band has fewer books, to reduce answer-key data entry before the first real test)
- **AI-vs-known-score comparison view** — a first-class Milestone 1 feature, not an afterthought: lets her (or you) upload a batch of already hand-graded tests and see, side by side, where the AI's read matched or missed the known-correct answer, student number, and teacher. This is the tool the accuracy pilot below actually runs on — building it as a real feature (not a one-off script) makes it reusable any time thresholds need re-tuning later, not just once before launch.

**Critical step — accuracy pilot:** before trusting this on real scores, run it against a stack of tests the librarian has *already hand-graded*, and compare:
- Field-read accuracy (quiz code, student number, teacher name, each answer)
- Score match rate against her known-correct scores
- False "clean" rate (things it graded confidently but got wrong) — this is the number that matters most, since a wrong silent grade is worse than an unnecessary review flag

Use this pilot to tune the confidence thresholds that decide what gets auto-passed vs. routed to review. Don't skip this step — it's the difference between a tool she trusts and one she has to double-check anyway.

**Exit criteria:** a real batch of already-known tests grades with accuracy the librarian is comfortable with, and both review queues are usable end-to-end.

## 4. Milestone 2 — Phase 2 Full Workflow (≈2–3 weeks)

- Second grade band added
- Per-teacher report generation + export (PDF/spreadsheet)
- Book Report Accountability Tracker, including the 2-week escalation behavior and the Home dashboard banner
- Batch history / Reports screen

**Exit criteria:** a full weekly cycle — scan, grade, review, export, forward to teachers, track any resulting book reports — works without needing you to intervene manually.

## 5. Soft Launch

Before rolling out to all 900 students at once:
- Pilot with **one class or one grade band** for a real testing cycle.
- Have the librarian use it exactly as she would week-to-week, including forwarding a real report to a real teacher.
- Collect her feedback specifically on: review queue speed, report clarity, and whether the escalation banner feels right (not too aggressive, not too quiet).
- Fix anything that surfaces before expanding to the full school.

## 6. Milestone 3 — Phase 3 / Stretch (ongoing, as needed)

Only after the above is stable and trusted:
- Simple trend view (e.g., how many students passed this month)
- Any refinements to CSV import (e.g., validation/error reporting on malformed rows)
- Anything else that comes up from real use — resist adding scope here until Phase 1–2 have proven themselves in actual weekly use.

## 7. Ongoing Risk Watch-list

| Risk | Mitigation |
|---|---|
| AI misreads handwriting more than expected | The review-queue design absorbs this by default; monitor the flag rate over time and keep it visible to the librarian as a "still improving" expectation, not a promise of perfection |
| A large batch (200 scans) is slow or times out | Test with a full-size batch during Milestone 1, not just small samples |
| Librarian data-entry burden at roster setup | CSV import is designed specifically to avoid 900 rows of manual entry — validate this path early, not last |
| Claude API cost scales unexpectedly | Track actual per-test API cost during the pilot and extrapolate to full-year volume before wide rollout |

---

*Next: Mobile Implementation.*
