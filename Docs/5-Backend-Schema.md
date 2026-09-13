# Backend Schema
## QuizWhiz

**Companion to:** QuizWhiz-PRD.md, QuizWhiz-TechStack.md
**Version:** 0.1 (Draft)
**Database:** PostgreSQL

---

## 1. Design Principles

- **No student names anywhere in this schema.** Students are identified only by `student_number`.
- **Teachers are real records**, since they're staff, not the children this app protects — and teacher identity drives grouping.
- **Grading and teacher-assignment are decoupled.** A test record can be fully graded while still "unassigned" to a teacher — these are independent status fields, per PRD 5.4.
- **History survives edits.** Renaming a teacher must not break historical records; deleting a teacher must not orphan students.

## 2. Tables

### 2.1 `teachers`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| first_name | text | |
| last_name | text | Used for matching against handwritten OCR text |
| is_active | boolean, default true | Set false on "delete" if you want a soft-delete audit trail instead of a hard delete — recommended |
| created_at | timestamptz | |
| updated_at | timestamptz | Bumped on rename |

### 2.2 `student_roster`
The Student → Teacher assignment table (PRD 5.8). One row per student number.

| Column | Type | Notes |
|---|---|---|
| student_number | text, PK | The only student identifier in the system |
| teacher_id | uuid, FK → teachers.id | Nullable only transiently during reassignment flows — should not be null in steady state |
| grade_band | enum('jr','3-5') | Which SSYRA list this student belongs to. **Informational only** — not cross-checked against `answer_keys.grade_band` at grading time. A mismatch (e.g., a Jr. student's sheet scanned with a 3-5 quiz code) still grades normally; this is a deliberate v1 simplification, not an oversight. |
| updated_at | timestamptz | |

**CSV import behavior:** upsert by `student_number` — an existing student_number updates `teacher_id`/`grade_band`; a new one inserts a row. Import never deletes rows (a student absent from the uploaded file is simply untouched). Rows that fail to parse or reference an unknown teacher are skipped and counted in a post-import summary shown to the librarian, rather than failing the whole import.

### 2.3 `answer_keys`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| quiz_code | text, unique | Printed on the physical test sheet; the join key between a scan and its key |
| book_title | text | |
| grade_band | enum('jr','3-5') | |
| question_count | integer | |
| created_at / updated_at | timestamptz | |

### 2.4 `answer_key_questions`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| answer_key_id | uuid, FK → answer_keys.id | |
| question_number | integer | |
| correct_answer | enum('A','B','C','D') | |

*Unique constraint on (answer_key_id, question_number).*

### 2.5 `batches`
One row per upload session (PRD 5.3 / 7.1 — batches are the unit of work, not a fixed weekly cycle).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| label | text | Auto-generated, e.g. "Tue 9/16, 10:04am" |
| source_type | enum('photo','pdf') | |
| item_count | integer | Number of individual tests in this batch |
| created_at | timestamptz | |

### 2.6 `test_records`
The core grading table — one row per individual scanned test.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| batch_id | uuid, FK → batches.id | |
| scan_order | integer | Position within the batch — drives report sort order (PRD 5.6) |
| quiz_code | text | Nullable if unreadable. **Not a hard FK** — deliberately: a quiz code can be read but not match any row in `answer_keys` (unrecognized code), which is a valid state, not a data error. Application code resolves it against `answer_keys.quiz_code` and treats "no match" the same as "unreadable." |
| student_number | text | As read (or later corrected); nullable if totally unreadable |
| ocr_teacher_last_name | text | Raw text as read off the sheet, kept for audit/debugging |
| resolved_teacher_id | uuid, FK → teachers.id, nullable | Set once assignment is resolved (from roster lookup or manual correction) |
| answers_json | jsonb | Per-question selected answer as read, e.g. `{"1":"B","2":"D",...}` |
| score_percent | numeric, nullable | Calculated, not model-provided. **Null when the quiz code has no matching answer key** — there's nothing to score against yet; gets computed once she resolves the key match in Grading Review. |
| passed | boolean, nullable | `score_percent >= 80`; null whenever `score_percent` is null |
| grading_status | enum('clean','needs_grading_review','resolved') | Tracks the *answer-reading* confidence path. An unmatched quiz code sets this to `needs_grading_review` with `flag_reasons` including `unrecognized_quiz_code` — this is the one case where grading itself is blocked, not just assignment |
| assignment_status | enum('clean','needs_assignment_review','resolved') | Tracks the *student/teacher-identification* confidence path — independent of grading_status |
| flag_reasons | text[] or jsonb | e.g. `["smudged_q4", "teacher_title_detected", "roster_mismatch", "unrecognized_quiz_code"]` |
| scan_image_ref | text, nullable | Storage path. **Retention (decided):** deleted once both `grading_status` and `assignment_status` reach `resolved`/`clean`, or 30 days after `created_at`, whichever comes first. A scheduled job (not a live check) is the simplest way to enforce the 30-day fallback. |
| reviewed_at | timestamptz, nullable | |
| created_at | timestamptz | |

**Indexes:** `student_number`, `quiz_code`, `(grading_status, assignment_status)` (for queue queries), `batch_id`.

### 2.7 `book_reports`
Triggered automatically whenever a `test_records` row has `passed = false`.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| test_record_id | uuid, FK → test_records.id | The failed test that triggered this |
| student_number | text | Denormalized for quick lookups even if the test record changes |
| teacher_id | uuid, FK → teachers.id, nullable | Follows the same resolution path as the test record; nullable until resolved |
| due_date | date | Date of the failed test |
| status | enum('outstanding','received') | |
| received_at | timestamptz, nullable | |
| escalation_level | enum('normal','escalated') | Flips to `escalated` once 2 weeks pass with status still `outstanding` — can be computed on read (`due_date < now() - interval '14 days'`) rather than stored, to avoid a background job dependency; storing it is also fine if a scheduled job is preferred |
| created_at | timestamptz | |

**Index:** `(status, due_date)` — drives the Outstanding/Escalated views efficiently.

### 2.8 `users`
Just the librarian's login.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| email | text, unique | |
| password_hash | text | (If using Supabase Auth, this table may be managed for you — listed here for completeness.) |
| created_at | timestamptz | |

### 2.9 `audit_log` *(recommended, not strictly required for v1)*
Given roster edits can retroactively affect historical records (renames, bulk reassignments), a lightweight audit trail is cheap insurance.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| action | text | e.g. `teacher_renamed`, `teacher_deleted_reassigned`, `student_reassigned`, `book_report_marked_received` |
| entity_type | text | e.g. `teacher`, `student_roster`, `book_report` |
| entity_id | text | |
| details | jsonb | Free-form context (old value → new value, etc.) |
| created_at | timestamptz | |

## 3. Entity Relationships

```
teachers ──1:N── student_roster ──N:1 (via student_number, not FK)── test_records
   │                                                                        │
   └──────────────── 1:N (resolved_teacher_id) ───────────────────────────┘

answer_keys ──1:N── answer_key_questions
answer_keys ──1:N── test_records (via quiz_code)

batches ──1:N── test_records

test_records ──1:1── book_reports (only when failed)
```

Note `student_roster` is joined to `test_records` by matching `student_number` values, not a formal foreign key — because a `test_records.student_number` can legitimately exist before a matching `student_roster` entry does (a scan comes in for a student not yet added to the roster; it sits in Needs Review until she adds them). This is intentional, not an oversight.

## 4. Derived / Computed Values (not stored, computed on read)

- Teacher report groupings: `SELECT ... FROM test_records JOIN student_roster ON test_records.student_number = student_roster.student_number WHERE student_roster.teacher_id = ? ORDER BY batch_id, scan_order`
- Escalated book reports: `WHERE status = 'outstanding' AND due_date < now() - interval '14 days'`
- Needs Review queue counts for the dashboard: simple `COUNT(*)` filters on `grading_status`/`assignment_status`.
- First-time setup checklist state (PRD 5.9 / App Flow Section 2): no new table needed — derive directly from existing counts: `EXISTS (SELECT 1 FROM answer_keys)`, `EXISTS (SELECT 1 FROM teachers)`, `EXISTS (SELECT 1 FROM student_roster)`. All three true = foundation set, dashboard switches from the setup checklist to the normal view.

---

*Next: Implementation Plan (how this gets built, phase by phase) and Mobile Implementation (the phone/PWA specifics).*
