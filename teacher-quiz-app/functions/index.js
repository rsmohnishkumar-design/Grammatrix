// Server side of push notifications. The app's own client-side code
// (js/notifications.js) already computes "what's pending" live and
// updates the in-app bell + the installed icon's badge — but none of
// that can run once the app is fully closed, since a closed tab has no
// JS running at all. These two triggers are what makes a notification
// actually arrive (OS banner + icon badge) even then, by watching
// Firestore from the server and pushing through FCM to registered
// device tokens (js/push.js writes those to the deviceTokens
// collection once someone grants permission).
//
// Deploy with: firebase deploy --only functions
// (run from inside teacher-quiz-app/, where firebase.json lives)

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const SOON_MS = 24 * 60 * 60 * 1000; // matches notifications.js's own "due soon" window

function roomLabel(grade, section, subject) {
  return `Grade ${grade} • Section ${section} • ${subject}`;
}

function toMillis(val) {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

async function tokensFor(filter) {
  const snap = await db.collection("deviceTokens").where("role", "==", filter.role).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => {
      if (filter.grade && String(t.grade) !== String(filter.grade)) return false;
      if (filter.section && String(t.section || "").toLowerCase() !== String(filter.section).toLowerCase()) return false;
      return true;
    })
    .map((t) => t.token);
}

async function sendToTokens(tokens, title, body, data) {
  if (!tokens.length) return;
  try {
    const res = await messaging.sendEachForMulticast({
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      tokens,
    });
    // A token stops being valid once the app is uninstalled or
    // notification permission is revoked — clean those up so future
    // sends don't keep retrying them.
    const dead = [];
    res.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (!r.success && (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered")) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await Promise.all(dead.map((t) => db.collection("deviceTokens").doc(t).delete().catch(() => {})));
    }
  } catch (err) {
    console.error("Push send failed:", err);
  }
}

// Fires on every write to a room doc. Two independent things it watches
// for: (1) a genuinely new/re-send (sentAt moved forward) -> tell that
// class's students; (2) the due date changed -> clear the "already
// notified" flags below so checkDueDates can fire again for the new
// deadline instead of staying silent because of the old one.
exports.onRoomWrite = functions.firestore.document("rooms/{roomId}").onWrite(async (change) => {
  if (!change.after.exists) return null;
  const after = change.after.data();
  const before = change.before.exists ? change.before.data() : null;

  const beforeSentMs = before ? toMillis(before.sentAt) : 0;
  const afterSentMs = toMillis(after.sentAt);
  const isNewSend = Array.isArray(after.questions) && after.questions.length > 0 && afterSentMs && afterSentMs !== beforeSentMs;

  const beforeDueMs = before ? toMillis(before.dueAt) : 0;
  const afterDueMs = toMillis(after.dueAt);
  const dueChanged = afterDueMs !== beforeDueMs;

  if (dueChanged && (after.notifiedSoonAt || after.notifiedExpiredAt)) {
    await change.after.ref.set(
      { notifiedSoonAt: admin.firestore.FieldValue.delete(), notifiedExpiredAt: admin.firestore.FieldValue.delete() },
      { merge: true }
    );
  }

  if (isNewSend) {
    const tokens = await tokensFor({ role: "student", grade: after.grade, section: after.section });
    await sendToTokens(tokens, "New test available", `${after.subject} is ready to take.`, {
      type: "new_test",
      roomId: change.after.id,
    });
  }
  return null;
});

// Runs every 15 minutes: due-soon reminders to students, expiry alerts
// to teacher/admin. Firestore rules don't gate this at all (the Admin
// SDK bypasses them) — it's purely a time-based scan since neither
// "soon" nor "expired" happens via a Firestore write on its own.
exports.checkDueDates = functions.pubsub.schedule("every 15 minutes").onRun(async () => {
  const now = Date.now();
  const snap = await db.collection("rooms").get();

  for (const doc of snap.docs) {
    const r = doc.data();
    if (!Array.isArray(r.questions) || !r.questions.length || !r.dueAt) continue;
    const dueMs = toMillis(r.dueAt);
    if (!dueMs) continue;

    if (dueMs <= now && !r.notifiedExpiredAt) {
      const [teacherTokens, adminTokens] = await Promise.all([
        tokensFor({ role: "teacher" }),
        tokensFor({ role: "admin" }),
      ]);
      await sendToTokens(
        [...teacherTokens, ...adminTokens],
        "Test expired",
        `${roomLabel(r.grade, r.section, r.subject)} has expired — reset & resend when ready.`,
        { type: "expired", roomId: doc.id }
      );
      await doc.ref.set({ notifiedExpiredAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } else if (dueMs > now && dueMs - now <= SOON_MS && !r.notifiedSoonAt) {
      const tokens = await tokensFor({ role: "student", grade: r.grade, section: r.section });
      await sendToTokens(tokens, "Test closing soon", `${r.subject} closes ${new Date(dueMs).toLocaleString()}.`, {
        type: "due_soon",
        roomId: doc.id,
      });
      await doc.ref.set({ notifiedSoonAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  return null;
});
