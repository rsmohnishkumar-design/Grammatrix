# Teacher's Hidden Room — Class Quiz App

A small standalone app (separate from the main Grammatrix app in this repo —
it does not touch it) for teachers to turn photos of textbook pages into a
quiz students can play on their phones.

## How it works

1. **Login** — everyone opens the same page and types a name.
   - Typing the code `4456` in the name box logs the teacher into the
     **Hidden Room**.
   - Any other name logs in as a student and waits for a quiz.
2. **Hidden Room (teacher only)**
   - Upload or photograph pages (multiple at once).
   - The app runs on-device OCR (via [Tesseract.js](https://tesseract.projectnaptha.com/))
     to read the text — no server or API key needed.
   - It generates multiple-choice questions from the extracted text (a
     fill-in-the-blank style, rule-based generator — see
     `js/questionGenerator.js`). Every question always includes an
     **"I don't know"** option.
   - Preview the set as **Just questions** (a plain answer key) or as the
     **Interactive preview** (exactly what students will see). Remove any
     question that came out badly before sending.
   - **Send to children** publishes the quiz live; students see it appear
     automatically. **Stop live quiz** takes it down again.
   - The room also lists everyone who has logged in and every quiz score
     submitted, live.
3. **Student view** — waits for a live quiz, then shows one question at a
   time with the options (including "I don't know"), and submits the final
   score automatically when finished.

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
