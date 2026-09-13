# App Flow
## QuizWhiz

**Companion to:** QuizWhiz-PRD.md
**Version:** 0.1 (Draft)

---

## 1. Overview

QuizWhiz has exactly one user role: **the librarian**. There are no teacher, parent, or student logins in v1. Every screen below is built around a single person moving quickly through a repetitive weekly task, so the flow favors speed and clarity over configurability.

## 2. First-Time Setup Sequence

Before the first real scan happens, the foundation has to be in place — otherwise every scan lands in Needs Review with nowhere to go, which defeats the purpose. This is the required order:

1. **Add Answer Keys** — every quiz code that might show up needs its answer key entered first. (You or the librarian both do this — whoever wrote/owns the quiz content.) It's fine to add these incrementally through the year as new books get tested, but *before* a book's first test day, its key needs to exist.
2. **Build the Teacher Roster** — add every teacher (Roster → Teachers).
3. **Import the Student Roster** — CSV upload of student number → teacher for all ~900 students (Roster → Students). This depends on step 2, since each row needs a matching teacher already in the system.
4. **Foundation set** — once 1–3 are done, the first scan batch should flow through with minimal Needs Review noise: quiz codes resolve against real keys, and students resolve against real teachers automatically.

**In the app itself**, this sequence should be a guided checklist on first login rather than something she has to know in advance — the Home dashboard's primary action changes from "Scan & Upload" to a setup checklist ("Add Answer Keys," "Add Teachers," "Import Students") until all three are done, then switches over to the normal day-to-day dashboard described below. This keeps with the "one clear primary action per screen" design principle — during setup, that action is *setup*, not scanning.

Ongoing, steps 1–3 aren't one-time-only: new books get keys added as they're written, and the roster gets updated through the year (Roster journeys in Section 5). The distinction is just that a *meaningful baseline* needs to exist before the first scan, so the very first real batch isn't a mess.

## 3. Screen Map

```
Login
  └── Home (Dashboard)
        ├── Scan & Upload ──► Processing ──► Batch Summary ──► Review Queue
        ├── Review Queue (Grading / Assignment tabs)
        ├── Reports (by teacher, by batch)
        ├── Book Report Tracker (Outstanding / Escalated)
        ├── Answer Key Library ──► Add/Edit Answer Key
        ├── Roster ──► Teachers tab ──► Add / Edit / Delete Teacher
        │         └── Students tab ──► CSV Import / One-by-one edit
        └── Settings
```

## 4. Screens

### 4.1 Login
- Single account (librarian). Email + password.
- No self-service signup — the account is provisioned once, by you, during setup.

### 4.2 Home (Dashboard)
The first thing she sees every time. Apple-style: generous whitespace, a handful of clear numbers, one obvious primary action.

- **Primary action:** "Scan & Upload" button, front and center.
- At-a-glance cards:
  - Tests graded this session/today
  - Items in **Grading Review**
  - Items in **Needs Review (Assignment)**
  - Outstanding book reports, with a **red, persistent banner** if any are past the 2-week escalation threshold (this banner should be impossible to miss and shouldn't quietly disappear — it stays until she acts)
- Quick links to Reports and Roster.

### 4.3 Scan & Upload
- Two entry points: **Take Photos** (camera) or **Upload PDF/Images** (file picker) — either path works, per the PRD.
- She can add multiple photos/pages to a single batch before submitting (since batch sizes range from ~10 to ~200).
- Each submission becomes one **batch/session**, auto-labeled with date + time (e.g., "Tue 9/16, 10:04am").

### 4.4 Processing
- Simple progress indicator while the AI reads and grades each test.
- No action needed from her here — this is a waiting screen, kept short and calm (not alarming; regular processing isn't the same as the book-report escalation).

### 4.5 Batch Summary
Shown immediately after processing finishes:
- X tests graded cleanly
- Y flagged for Grading Review
- Z flagged for Needs Review (Assignment)
- One tap into either queue from here.

### 4.6 Review Queue
Two tabs, since these are different problems (see PRD 5.5):

**Grading Review** — the answer marks themselves were unclear.
- Scan image on one side, her correction controls on the other.
- She confirms or corrects the circled answer(s); score recalculates live.

**Needs Review (Assignment)** — student number, quiz code, or teacher name couldn't be confidently resolved, or the teacher cross-check didn't match the roster, or a title/honorific was detected.
- Scan image alongside: the OCR'd student number, OCR'd teacher name, and (if relevant) what the roster says instead.
- She can correct the student number, and/or assign/confirm the teacher directly from here — no need to leave and go to Roster.
- The test's score is already calculated and saved (see PRD 5.4) — resolving this queue only affects which teacher's report it lands in.

Design goal: this is the screen that eats her actual time each week, so every unnecessary tap is a cost. One flagged item should be resolvable in a couple of taps.

### 4.7 Reports
- List of batches/sessions, most recent first.
- Within a batch (or across a date range), she can generate a **per-teacher report** — grouped by teacher (from the roster), sorted in scan order within each teacher's group.
- Export as PDF or spreadsheet.
- Anything still sitting in Needs Review is excluded from teacher reports (never a guess) and shown separately.

### 4.8 Book Report Tracker
- **Outstanding** list, grouped by teacher, each entry showing days outstanding.
- **Escalated** section (or filter) for anything past 2 weeks — styled distinctly (red/urgent) and surfaced on the Home dashboard too, not just buried here.
- One tap to mark a report **Received** once she physically has it in hand.
- Entries with an unresolved teacher land in the same Needs Review queue as scores.

### 4.9 Roster
**Teachers tab**
- List of all teachers, with student counts.
- Add teacher (first + last name).
- Edit teacher (rename in place — cascades automatically, per PRD 5.8).
- Delete teacher — blocked until every student is reassigned; the deletion flow walks her through reassigning them (she can split across multiple teachers) before the delete completes.

**Students tab**
- Searchable list of student numbers with their assigned teacher.
- **CSV import** for bulk roster building/refresh.
- One-by-one add/edit for individual changes (a student switching classes mid-year).

### 4.10 Settings
- Account/password management.
- A short, plain-language note on what data QuizWhiz stores (student numbers and scores only — no names) so she has something to point to if a teacher or parent asks.

## 5. Key User Journeys

### Journey A — A normal testing session
1. Class finishes testing (or morning walk-in testers finish).
2. Librarian photographs or scans the stack.
3. Uploads as one batch from Home → Scan & Upload.
4. Reviews the Batch Summary; clears any Grading Review items right away if she has a moment, or comes back to it later.
5. Later, generates and exports per-teacher reports to forward.

### Journey B — Resolving a flagged item
1. She opens Needs Review (Assignment) from Home.
2. Sees a scan where the teacher field read "Mrs. Smith" (title detected → auto-flag).
3. Confirms the correct teacher is "Smith" in one tap; record now appears in Smith's report.

### Journey C — Start-of-year roster setup
1. She pulls the teacher list from the school website and adds each teacher (or edits existing ones from last year).
2. She CSV-imports the student number → teacher assignments once class lists are finalized.
3. Ongoing: individual moves as needed through the year.

### Journey D — A book report goes unresolved
1. A student scores 72% → book report record auto-created, status Outstanding.
2. It appears in that teacher's Outstanding list.
3. Day 14 passes with no update → it escalates: red styling, resurfaces on Home every time she logs in.
4. She receives the paper report, marks it Received — it drops off the alert list immediately.

### Journey E — A teacher leaves mid-year
1. Librarian goes to Roster → Teachers → deletes "Jones."
2. App blocks the delete and prompts reassignment.
3. She reassigns Jones's 22 students — say, 14 to Thompson, 8 to Martinez.
4. Delete completes; all historical and future records for those students now point to their new teacher.

---

*See also: Tech Stack, Content Guidelines, Backend Schema, Implementation Plan, Mobile Implementation.*
