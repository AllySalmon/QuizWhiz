# Content Guidelines
## QuizWhiz

**Companion to:** QuizWhiz-PRD.md, QuizWhiz-AppFlow.md
**Version:** 0.1 (Draft)

---

## 1. Voice & Tone

QuizWhiz exists to take stress off three groups: **students** (relief from not knowing), **teachers** (relief from guessing), and **the librarian** (relief from an impossible grading backlog). The app's language should reflect that — calm, plain, and respectful of a very busy person's time and attention.

- **Warm, not cutesy.** No forced enthusiasm, no gimmicky mascot-speak. This is a professional tool for a school employee.
- **Plain language over technical language.** The librarian is not necessarily technical — avoid engineering terms ("payload," "sync," "record") in favor of what she'd actually say ("scan," "batch," "student").
- **Calm by default, loud only when it matters.** Most of the app should feel quiet and orderly. The one deliberate exception is the book-report escalation — see Section 4.

## 2. Terminology Glossary

Use these terms consistently everywhere in the UI — copy, buttons, emails, error states. Inconsistent naming (calling the same thing "batch" in one place and "session" in another) is a common source of confusion in tools like this.

| Term | Meaning | Don't say instead |
|---|---|---|
| **Quiz Code** | The ID printed on a test sheet linking it to its answer key | "Test ID," "key code" |
| **Student Number** | The only student identifier the app uses | "Student ID" (reserve "ID" language for staff/teacher records, to keep the no-name policy visually distinct in her mind too) |
| **Batch** | One upload session (a stack of scans/photos submitted together) | "Session," "upload," "job" |
| **Grading Review** | Queue for unclear answer marks | "Grading queue," "QA" |
| **Needs Review (Assignment)** | Queue for unresolved student/teacher identification | "Assignment queue," "exceptions," "Needs Teacher" |
| **Outstanding** | A book report not yet received | "Pending," "overdue" (reserve "overdue" language for the escalated state specifically) |
| **Escalated** | A book report outstanding 2+ weeks | — |

## 3. Microcopy Examples

**Buttons:** short, verb-first. "Scan & Upload," "Mark Received," "Reassign Students," not "Click here to..." or "Submit."

**Empty states** (should feel like good news, not blank/broken):
- Empty Grading Review: *"Nothing to review — every mark was read clearly."*
- Empty Needs Review: *"All tests are assigned to a teacher."*
- Empty Outstanding Book Reports: *"No outstanding book reports right now."*

**Setup checklist** (first login, before Answer Keys/Roster exist — see PRD 5.9):
- Frame it as progress, not a chore: *"2 of 3 set up — add your student roster to finish."*
- Each item states the action plainly: *"Add Answer Keys,"* *"Add Teachers,"* *"Import Students,"* not vague labels like "Configuration."

**Confirmation dialogs** (especially destructive ones):
- Deleting a teacher: *"Before removing [Teacher], reassign their [N] students to another teacher."* — state the requirement plainly rather than a generic "Are you sure?"
- CSV import overwrite: *"This will update [N] students' teacher assignments. Review the changes before confirming."*

**Error states:** describe what happened and what to do, not a raw system error. *"This image is too blurry to read — try retaking the photo in better light."* rather than *"Processing failed."*

## 4. The Escalation Banner (Special Case)

This is the one place the PRD explicitly calls for something "alarming and an annoyance" (Section 5.7) — worth handling deliberately rather than just cranking up the intensity everywhere else too.

- **Visual treatment carries the urgency**, not the words: red/high-contrast styling, persistent placement on the Home dashboard, resurfacing every session until resolved.
- **The copy itself stays factual and respectful**, even though the visual is loud: *"3 book reports have been outstanding for 2+ weeks"* — not "URGENT!!" or anything that reads as scolding the librarian. She's not the one behind — the copy shouldn't imply otherwise.
- Never word this in a way that could read as blaming a specific student either, since this is a staff-facing tool, not student-facing — no phrasing like "so-and-so still owes work."

## 5. Accessibility Notes

- **Never rely on color alone** to signal escalation — pair red styling with an icon and explicit text ("Escalated," not just a red dot), for colorblind accessibility.
- Maintain sufficient contrast ratios for all status colors against the clean/light Apple-style background.
- All icon-only buttons (e.g., in the Review Queue) need accessible labels for screen readers, even if this is a single-user tool — good practice costs little here and matters if her device's assistive features are ever on.
- Font sizes should stay comfortably legible on a phone screen, especially in the Review Queue where she's cross-referencing a scanned image with small text.

## 6. Privacy Messaging

Since a teacher or parent may eventually ask "what does this app actually store," it's worth having one clear, ready-made line living in Settings (see App Flow 3.10):

> *"QuizWhiz stores student numbers and quiz scores only — never student names, photos of students, or other identifying information."*

Keep this accurate as the single source of truth; don't let marketing-style language drift from what the Backend Schema doc actually implements.

---

*Next: Backend Schema.*
