# Testify — Class Test App

A small standalone app (separate from the main Grammatrix app in this repo —
it does not touch it) for teachers to turn photos of textbook pages into a
test students can take on their phones or laptops.

## How it works

1. **Login** — everyone opens the same page and types a name.
   - Typing the code `4456` in the name box logs the teacher into the
     **Hidden Room**.
   - Any other name logs in as a student. Students also pick their **Grade**
     (1st–12th) and type their **Section** (e.g. "A") — this is what scopes
     which tests they can see.
2. **Hidden Room (teacher only)**
   - The sidebar lists **Grade 1–12**. Click a grade to open its room.
   - Inside a grade, set the **Section** and **Subject** (e.g. "A" /
     "Biology") — a room only becomes active, and only becomes visible to
     matching students, once both are filled in. A teacher can manage many
     rooms (different sections and/or subjects) by switching these two
     fields; each room's questions, live status and scores are kept
     separate, keyed by grade + section + subject.
   - Upload or photograph pages (multiple at once).
   - The app runs on-device OCR (via [Tesseract.js](https://tesseract.projectnaptha.com/))
     to read the text — no server or API key needed.
   - It generates multiple-choice questions from the extracted text (a
     fill-in-the-blank style, rule-based generator — see
     `js/questionGenerator.js`). Every question always includes an
     **"I don't know"** option. Choose how many questions to generate (max 50).
   - Preview the set as **Just questions** (a plain answer key) or as the
     **Interactive preview** (exactly what students will see). Remove any
     question that came out badly before sending.
   - **Send to children** publishes that room's test live; matching students
     see it appear automatically, grouped by subject. **Stop live test**
     takes it down again.
   - The room also lists everyone who has logged in (filtered to that grade
     + section) and every score submitted for that specific room, live.
3. **Student view** — the home screen shows a card per subject that currently
   has a live test for the student's grade + section. Starting one shows one
   question at a time (including "I don't know"), then a review screen
   before the final, locked submission. Past attempts show in "Test
   attended" with their subject and score.

## Setup

1. Create a Firebase project (a separate one from the main Grammatrix
   project — don't reuse those credentials).
2. Enable **Firestore** and **Storage** in that project.
3. Copy your web app config into `js/firebase-config.js`, replacing the
   `YOUR_...` placeholders.
4. Deploy the security rules in `firestore.rules` and `storage.rules` (or
   paste their contents into the Firebase console's Rules tab).
5. Serve the folder as static files (Firebase Hosting, GitHub Pages, or any
   static host — there is no build step).

## Security note

Teacher access is gated only by the shared code `4456` checked in the
browser — there is no real per-user authentication behind it. That's
enough to keep casual visitors out of the Hidden Room, but anyone who knows
to open the browser dev tools could call the same Firestore functions
directly (e.g. to publish a fake quiz). Treat this as a lightweight
classroom tool, not something protecting sensitive data. If you want real
tamper-resistance later, the natural upgrade is Firebase Authentication
(e.g. anonymous sign-in) with a Cloud Function that checks the code
server-side before granting a "teacher" custom claim.

## Limitations

- OCR quality depends on the photo — clear, well-lit, flat pages work best.
- Question generation is a simple heuristic (blank out a key word from a
  real sentence + a couple of distractor words from the same text), not an
  AI model — it won't produce comprehension or reasoning questions, just
  recall-style fill-in-the-blanks. Good enough for a quick check, not a
  replacement for teacher-written questions.
