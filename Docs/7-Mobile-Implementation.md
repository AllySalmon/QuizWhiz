# Mobile Implementation
## QuizWhiz

**Companion to:** QuizWhiz-TechStack.md, QuizWhiz-AppFlow.md
**Version:** 0.1 (Draft)

---

## 1. Approach: Progressive Web App (PWA), Not a Native App

Given the constraints (single user, no budget, web + mobile both required per PRD Section 10), a **PWA** — the same Next.js app, installable to her home screen — is the recommended approach rather than a separate native iOS/Android build.

**Why:**
- One codebase instead of two (or three, counting web).
- No App Store / Play Store review process or developer account fees — matters since there's no budget and no OCPS approval process to lean on either.
- Installs to her home screen and behaves like an app (full-screen, own icon) despite being a web app underneath.
- Camera access, file upload, and (with some setup) push notifications are all achievable through standard web APIs — enough to cover QuizWhiz's actual mobile needs.

**Trade-off to accept:** slightly less native polish than a true native app (e.g., camera capture is a browser API, not a fully custom native camera UI). For this app's use case — occasional photo capture, not a camera-heavy experience — that trade-off is worth the simplicity.

## 2. Mobile-Specific Screen Adjustments

Reusing the App Flow doc's screens, with mobile-specific layout:
- **Bottom tab bar** (mobile pattern) instead of the web's sidebar/top nav: Home, Scan, Review, Reports/Alerts.
- **Scan & Upload becomes camera-first** on mobile: opening this screen should default straight into the camera, not a file picker, since photographing tests on the spot is the primary mobile use case.
- **Review Queue** needs larger touch targets and a layout that works one-handed — this is likely used standing at the circulation desk between students, not sitting at a desk.

## 3. Camera Capture Flow

- Use `<input type="file" accept="image/*" capture="environment">` (or the MediaDevices API for a more custom in-app camera view) to access the rear camera directly.
- **Multi-shot batching:** let her photograph one test, confirm it's in frame/legible, then immediately photograph the next — building up a batch before a single upload, rather than uploading one photo at a time (matches batch sizes of 10–200).
- **Image compression before upload:** library Wi-Fi may not be fast or reliable; compress images client-side before sending, to keep a 200-photo batch from stalling on upload.

## 4. Offline Resilience

Library connectivity may be inconsistent, especially mid-batch:
- Photos taken while offline (or mid-upload failure) should queue locally (e.g., via a service worker + IndexedDB) rather than being lost.
- The app should clearly show "queued, will upload when connected" rather than silently failing — consistent with the Content Guidelines principle of never leaving her guessing about what happened.
- Once connectivity returns, queued items upload automatically as one batch.

## 5. Escalation Alerts on Mobile

The PRD calls for book-report escalation to be genuinely hard to ignore. On mobile, this can go a step further than the in-app banner:
- **Web Push notifications** (supported by PWAs on both iOS 16.4+ and Android) can notify her even when the app isn't open.
- **App icon badge count** showing the number of escalated items, if the platform supports it — a small, persistent visual nudge alongside the push notification.
- Escalation notifications should **not repeat so often that she starts ignoring or muting them** — a daily reminder while something is escalated is likely sufficient intensity, rather than hourly pings; tune this based on her actual feedback during the soft launch (Implementation Plan, Section 5) rather than guessing up front.

## 6. Initial Setup on Mobile

The first-time setup checklist (PRD 5.9 / App Flow Section 2) works on mobile, but the **CSV import of ~900 students** is realistically a desktop task — it likely means downloading/reviewing a spreadsheet, which is awkward on a phone screen. Recommend she do the initial Answer Key and Roster setup on the web app at a computer, and reserve mobile for its actual strength: photographing tests on the go and quick Review Queue triage. Day-to-day individual roster edits (one student switching classes) work fine on mobile either way.

## 7. Device Testing

- Test on both iOS Safari and Android Chrome specifically — PWA support (especially push notifications and camera behavior) differs meaningfully between the two.
- Test the camera flow in actual library lighting conditions, not just a well-lit office — this affects both her experience and the AI grading accuracy downstream.

## 8. What's Explicitly Out of Scope for v1

- No native app store listing.
- No biometric login (Face ID/fingerprint) — a simple password is sufficient for a single low-friction account at this scale; revisit only if she requests it.
- No multi-device sync conflict handling beyond what Supabase provides by default — she's one person, unlikely to be mid-batch on two devices simultaneously.

---

*This completes the initial QuizWhiz documentation set: PRD, App Flow, Tech Stack, Content Guidelines, Backend Schema, Implementation Plan, and Mobile Implementation.*
