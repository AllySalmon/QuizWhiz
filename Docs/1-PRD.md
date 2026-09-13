# Product Requirements Document
## QuizWhiz
*(SSYRA Reading Test Grader)*

**Version:** 0.1 (Draft)
**Date:** September 13, 2026
**Owner:** [Your name]
**Stakeholder:** School librarian (grades K–5, SSYRA Jr. & SSYRA 3–5 programs)

---

## 1. Background

The school previously used Renaissance/Accelerated Reader (AR) to let students take comprehension quizzes after finishing a book and get instant, automatically-graded scores (80%+ required for credit). OCPS cut funding for Renaissance this year, so the librarian and a team of teachers wrote their own paper quizzes (multiple choice, A/B/C/D, students circle their answer) for the books on the SSYRA Jr. and SSYRA 3–5 reading lists.

With ~900 students testing on paper, grading has become a bottleneck:
- The librarian can't grade fast enough to give students, teachers, or parents timely feedback.
- Teachers don't reliably get scores back.
- Students are left not knowing if they passed.

## 2. Problem Statement

There is no fast, reliable, low-effort way to turn a stack of hand-graded paper quizzes into a weekly score report, without reintroducing the cost/infrastructure of a commercial platform like Renaissance.

## 3. Goals

| Goal | Success looks like |
|---|---|
| Eliminate manual grading bottleneck | Librarian scans a batch of tests and gets scores back same day |
| Give teachers a reliable weekly source of truth | Librarian can forward a clean per-class report every week |
| Preserve the "pass/fail" motivation loop for kids | Every student who tests gets a scored, credited/not-credited result |
| Keep student data minimal and low-risk | App never stores or sees student names — only school-assigned student numbers |
| Close the loop on failed tests | No student who owes a book report falls through the cracks — status is tracked until received, with escalating visibility over time |

### Non-goals (v1)
- Replacing Renaissance's full feature set (reading levels, point goals, prizes, etc.)
- Teacher or parent-facing login/portal — the librarian is the sole user and distributes reports manually
- Handling written/short-answer questions — v1 is multiple choice (A/B/C/D) only
- Writing or managing the quiz content itself — the librarian's team continues to own quiz creation and answer keys

## 4. Users

**Primary user: The librarian.**
She is the only person who logs into or interacts with the app directly. She:
1. Uploads/maintains answer keys (one per book/quiz).
2. Scans/photographs completed student tests in batches.
3. Uploads scans to the app.
4. Reviews the graded results (and flags/fixes anything the app is unsure about).
5. Exports/downloads a weekly report and forwards it to teachers herself (outside the app — email, printed handout, etc.).

There are no other app users in v1. Teachers and parents receive results only via what the librarian forwards.

## 5. Core Workflows

### 5.1 Answer Key Setup (one-time per quiz, ongoing as new quizzes are written)
- Librarian creates an answer key entry for a book: title, grade band (Jr. or 3–5), number of questions, correct answer per question (A/B/C/D).
- Each answer key gets a short code/ID (e.g., a quiz code) — this is what ties a scanned test back to the right key. This code should be printed on the test sheet itself so grading doesn't rely on the librarian remembering which key goes with which stack.
- Answer keys can be edited if a mistake is found (e.g., question 4's key was wrong). **Re-grading is a manual, explicit action, not automatic:** saving an edited key shows her "N tests used this key — recompute their scores?" She confirms before anything recalculates. Silent auto-recompute is deliberately avoided — a score on a report she's already forwarded to a teacher should never change without her knowing.

### 5.2 Test Design Requirements (constraints on the paper test, not the app)
For reliable automated grading, each test sheet should have, in a consistent layout:
- The quiz/book code (printed or clearly marked)
- The student number (**no name**, filled in by the student or pre-printed)
- The teacher's **last name only** — students are instructed not to write "Mr./Mrs./Ms./Miss," just the surname
- A clean answer-circling area, one line per question, options A/B/C/D

We'll define an exact template in the next phase so the AI grader has a consistent layout to read.

**Validation rule:** if the teacher field contains a title (Mr., Mrs., Ms., Miss, or similar), that's an automatic fail on this field — the entry is routed to the Needs Review queue rather than guessed or auto-stripped, since a title prefix means the student didn't follow the instructions and the name underneath may not be reliably parsed.

### 5.3 Scanning & Upload
- Librarian scans (via copier/scanner → PDF) or photographs (via phone) a batch of completed tests.
- She uploads the batch to the app — supporting both PDF (multi-page) and photo (JPG/PNG, possibly multiple images) uploads.
- App splits a batch into individual tests (one per page/photo).

### 5.4 Grading
- For each test image/page, the app makes **one AI read** of the full sheet — quiz code, student number, teacher last name, and every circled answer, all in a single pass. Scoring itself (comparing the read answers to the stored key) is deterministic code, not a second AI call.
- The app then:
  1. Looks up the answer key for the quiz code read off the sheet.
     - **If the quiz code can't be read, or doesn't match any stored answer key, the test cannot be scored — there's nothing to grade against.** This is the one case where grading itself is blocked, unlike a messy student number or teacher name (which never block scoring). It routes to **Grading Review** (not a new/third queue) with a distinct flag (`unrecognized_quiz_code`) and a null score, so it's visually distinguishable from "confirm my correction" items — this one needs a key match before anything else can happen.
  2. Compares read answers to the key and calculates a percentage score and pass/fail (≥80%).
  3. Looks up the student number in the librarian-maintained **Student → Teacher roster** (see 5.8) to determine the authoritative teacher for grouping. This is more reliable than relying on handwriting alone.
  4. Cross-checks the handwritten teacher name against the roster's answer for that student number. A mismatch (or a title/honorific — see 5.2) doesn't block grading, but flags the record for the Needs Review queue, since it may signal a misread student number or a student writing the wrong teacher.
- Anything else the app can't read confidently (smudged circle, two answers circled, missing/illegible student number, student number not found in the roster) is **flagged for the librarian to review**, not silently guessed. **The test is still graded** — the score is calculated and saved — it just sits in the Needs Review queue, unassigned to any teacher's report, until she adds/corrects the student number's roster entry. Grading and teacher-assignment are independent steps for every case except an unmatched quiz code (above), which blocks grading itself since there's no key to score against.

### 5.5 Review
Two related but distinct review queues:
- **Grading review**: tests where the answer marks themselves were unclear (smudged, double-circled, etc.) — librarian views the scan and corrects the answer.
- **Assignment review ("Needs Review (Assignment)")**: tests/reports where the student number, quiz code, or teacher name couldn't be confidently read — these don't get auto-routed into a teacher's report. Instead they land in a separate queue/report where the librarian views the scan and manually assigns the correct teacher (and/or fixes the student number).

For each flagged item in either queue, she views the original scan side-by-side and corrects it in a couple of clicks.

### 5.6 Weekly Report
- Reports are grouped **by teacher**, using the Student → Teacher roster (see 5.8) as the source of truth — not the handwriting on the sheet. This means the librarian can generate and forward one clean report per teacher instead of sorting a flat list herself.
- Within a teacher's report, entries are sorted in **scan order** (the order she fed those tests in).
- Anything that couldn't be confidently assigned (student number not in the roster, or a flagged mismatch/title issue — see 5.4) goes into the separate **"Needs Review"** queue (see 5.5) instead of a teacher's report — so a report never contains a guess.
- Report includes: student number, book/quiz taken, score, pass/fail, date tested.
- Exportable (e.g., PDF or spreadsheet) so the librarian can forward each teacher's report as-is.
- Since testing is staggered (see Section 7.1), reports should be generated per batch/session (e.g., "Tuesday 10am scan") rather than forced into a single weekly bundle — she can then combine or forward batches as fits her workflow.

### 5.7 Book Report Accountability Tracker

When a student scores below 80%, they owe a book report (paper form, filled out by hand — see uploaded template) instead of retesting. This creates a follow-up obligation the librarian needs to track until resolved.

**Privacy note:** with the updated form (student number + teacher name, no student name), the book report tracker stays fully aligned with the "no student PII" rule without needing any special-case handling. The app tracks a lightweight status record, tied to student number and teacher:

- Student number
- Teacher
- Book/quiz that was failed
- Date the report became due (i.e., date of the failed test)
- Status: **Outstanding** or **Received**
- Days outstanding (calculated automatically from the due date)

**Workflow:**
1. A failing score (<80%) automatically creates an outstanding book-report record — no manual step needed.
2. The record appears on a dedicated "Outstanding Book Reports" view, and continues to appear in that view (and in relevant batch/session reports) until the librarian marks it received.
3. When the librarian physically receives a student's paper book report, she marks that record **Received** in the app — this is a manual confirmation step, since the app has no way to "see" the paper report itself.
4. **Escalation:** if a record is still Outstanding after 2 weeks, it becomes a **high-priority alert** — visually distinct (e.g., red/urgent styling) and persistent: it should resurface prominently every time she opens the app or generates a report, not just sit quietly in a list, until she resolves it.
5. Like the score reports, outstanding book report records are grouped by teacher; any record where the teacher couldn't be confidently read lands in the same "Needs Review" queue (see 5.5) for manual assignment.

This means "Outstanding Book Reports" isn't a one-time report — it's a running, persistent list that only shrinks when the librarian takes action, and gets louder the longer something sits unresolved.

### 5.8 Teacher & Student Roster Management

The app maintains its own self-contained roster — no connection to any official school/district system. This is the authoritative source for grouping reports and book report tracking by teacher.

**Teacher roster:**
- Librarian can **add** a new teacher (first + last name — she'll source this from the school website's staff list).
- Librarian can **edit** a teacher's name in place — e.g., "Jones" becomes "Carter" because the same person got married. This is a rename, not a new record: every student currently assigned to that teacher (and all their past and future score/book-report records) automatically follows the updated name. No manual re-linking needed.
- Librarian can **delete** a teacher. Deletion is **blocked until every one of that teacher's students has been reassigned** — the app should not allow orphaned students. Reassignment doesn't have to go to a single replacement teacher: she can split the roster across multiple teachers (e.g., half of Jones's class goes to Thompson, half to Martinez) as part of the same deletion flow.

**Student → Teacher assignment:**
- Librarian assigns each student number to a teacher. This is the roster that gets built once per year/class and updated as needed (schedule changes, new students, teacher changes).
- This roster contains **student numbers only — never student names** — consistent with the app's core privacy rule.
- Two ways to build/update it:
  - **CSV upload** — for the initial roster build (or a bulk refresh), she uploads a spreadsheet of student number → teacher pairs instead of entering 900 students one at a time. **Behavior: upsert by student number** — a row for a student number already in the roster updates their teacher; a new student number inserts a new row. Nothing is deleted by a CSV import (a student missing from the file simply isn't touched). Malformed rows (unrecognized teacher, missing student number, etc.) are skipped rather than failing the whole import, and she sees a summary afterward ("18 updated, 2 skipped — unrecognized teacher"). Full per-row validation UI (highlighting exactly which rows and why) is a Phase 3 nice-to-have, not required for the basic import to work.
  - **One-by-one entry/edit** — for ongoing changes, like a single student switching classes mid-year.

### 5.9 Required Setup Sequence

Grading and assignment both depend on data that has to exist first: an answer key before a quiz code means anything, and a roster before a student number can be grouped to a teacher. The required order is:

1. Answer Keys (5.1)
2. Teacher roster (5.8)
3. Student → Teacher roster, via CSV import (5.8)

This isn't a hard technical gate — a scan uploaded before setup is complete still gets graded, it just lands entirely in Needs Review with nothing to resolve against. To avoid that happening by accident, the Home dashboard's primary action should be a **guided setup checklist** on first login, replacing "Scan & Upload" until all three steps are done (see App Flow doc, Section 2, for the full UX). This keeps the "one clear primary action per screen" design principle intact — during setup, the priority action *is* setup.

Ongoing (not just at initial launch): new answer keys get added as new books are tested through the year, and the roster gets updated for new students, teacher changes, etc. The requirement is only that a meaningful baseline exists before each thing's *first* appearance in a scan.

## 6. Privacy & Data Handling

This is a deliberate constraint, not an afterthought, since this involves K-5 children's data:

- **No student names, photos of faces, or other directly identifying information are ever entered into or stored by the app** — only school-assigned student numbers. (Teacher names *are* stored, since teachers are staff, not the children whose privacy this rule protects — and teacher name is what drives report grouping.)
- The student-number-to-name mapping stays entirely with the school (teachers/librarian); the app never receives or needs it.
- **Scanned test image retention (decided):** an image is deleted once **both** `grading_status` and `assignment_status` are resolved — or **30 days after upload, whichever comes first**, as a safety net for anything that lingers unresolved. Only the extracted score/answer data is kept after that; the image itself is gone.
- **Grade band (Jr. vs. 3–5) is informational, not enforced.** If a student's roster grade band doesn't match the quiz's grade band, the app still grades it normally — this is treated as an edge case not worth blocking on for v1, not an oversight.
- Only the librarian has login access in v1.
- **Updated:** the app now maintains a self-contained Student Number → Teacher roster (see 5.8), entered and controlled entirely by the librarian — it has no connection to any official OCPS/district system. This is different from validating against an external enrollment database (which remains out of scope): the app still never knows a student's real name, and a number that isn't yet in the roster simply routes to Needs Review rather than being rejected as "invalid." (Trade-off: a misread or mis-transcribed student number that happens to match a *different* real student's number in the roster could be mis-grouped — the teacher cross-check in 5.4 is the main safeguard against this.)
- We'll confirm hosting approach in the tech section below, but the goal is to avoid any third-party data-sharing beyond what's needed to run the grading itself.

## 7. Reliability & Accuracy Expectations

- Hand-circled A/B/C/D marks are a well-suited case for AI image grading, but not infallible — expect occasional ambiguous marks.
- v1 design principle: **flag uncertainty rather than guess**. A wrong "flag for review" costs the librarian a few seconds; a wrong silent grade costs a student's credit or a parent's trust.
- We should pilot with one real batch of already hand-graded tests before rollout, to compare AI-graded vs. librarian-graded results and tune confidence thresholds.

### 7.1 Volume & Cadence
Testing is staggered, not a single weekly bulk event:
- Each class has a dedicated day/time slot in the library.
- Students can also test independently starting at 8am.
- Batch sizes vary widely — anywhere from ~10 to ~200 scans in a given session.

The app should treat each upload as its own batch/session (no fixed "weekly" assumption baked in) and handle small and large batches equally well. The librarian keeps her existing scheduling — the app just needs to keep up with whatever she scans, whenever she scans it.

### 7.2 No Retesting
If a student scores below 80%, they do not get a second attempt at the paper test — they write a book report instead (see Section 5.7). The app does not need retry/attempt-tracking logic for the quiz itself.

## 8. Success Metrics

- Time from "librarian has a stack of paper tests" to "scores exist" — target: same day, down from the current multi-day/never backlog.
- % of tests requiring manual review — track and drive down over time as the test template/process is refined.
- Librarian-reported trust in the scores (qualitative check-in after first few weeks).
- Average time a book report stays "Outstanding" before being marked received — and whether the 2-week escalation actually gets stragglers resolved faster.

## 9. Decisions (Resolved)

| # | Question | Decision |
|---|---|---|
| 1 | Standardize the test template? | No — grade the existing format as-is (circled A/B/C/D, quiz code + student number already on sheet) |
| 2 | Cross-reference student numbers against a roster? | **Updated:** the app maintains its own internal Student → Teacher roster (librarian-built, no student names, no connection to any official district system) to drive teacher-based grouping — see 5.8. It still never checks against an official enrollment list |
| 3 | Report grouping | ~~Sorted in scan order~~ **Updated:** grouped by teacher, using the librarian-maintained Student → Teacher roster (5.8) as the source of truth, sorted by scan order within each teacher's group. Handwriting on the sheet is a cross-check, not the source. Anything unresolved goes to a separate "Needs Review" queue rather than being guessed |
| 4 | Volume/cadence | Staggered by class schedule + 8am walk-in testing; batches range ~10–200. App must handle any batch size, any time, not a fixed weekly bulk job |
| 5 | Retesting | None — a sub-80% score means a book report instead, no second paper-test attempt |
| 6 | Hosting/approval | No OCPS approval needed for now; school is directly authorizing this for the librarian. Should work as both a web app and a mobile app |

## 10. Platform

- **Web + mobile.** The librarian should be able to use this from a phone (e.g., photographing tests right at her desk) or a computer (e.g., uploading scanner PDFs, reviewing flagged items on a bigger screen).
- No school IT/OCPS integration required for v1 — this runs independently, authorized directly by the school for the librarian's use.

## 11. Proposed Phases

| Phase | Scope |
|---|---|
| **Phase 1** | Answer key management + single-batch upload/grading/review for one grade band, tested against a handful of already-known-score tests to validate accuracy |
| **Phase 2** | Full weekly workflow: batch upload, review queue, exportable report, both grade bands, Book Report Accountability Tracker (including 2-week escalation) |
| **Phase 3 (stretch)** | Nice-to-haves depending on how Phase 1–2 go — e.g., duplicate/retake handling, class-level grouping, simple trend view for the librarian |

## 12. Design Direction

Clean, spacious, Apple-style visual language:
- Generous whitespace, minimal chrome, calm neutral palette with one accent color
- Large, legible typography
- Every screen should have one clear primary action (upload, review, export)
- The review queue should feel fast — minimal clicks per flagged item, since this is the part that will consume the librarian's actual time each week

---

*This PRD is the source of truth for all QuizWhiz decisions. Companion docs: App Flow, Tech Stack, Content Guidelines, Backend Schema, Implementation Plan, Mobile Implementation.*
