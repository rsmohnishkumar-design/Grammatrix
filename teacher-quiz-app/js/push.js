// Real OS-level push notifications via Firebase Cloud Messaging — the
// difference from notifications.js is that these work even while the
// app is fully closed (no open tab at all), because a service worker
// keeps running in the background for exactly this. Foreground pushes
// (app open right now) are shown here directly instead of relying on
// the OS banner, since a visible tab should just update, not interrupt.
//
// Needs one manual setup step in Firebase Console: Project Settings ->
// Cloud Messaging -> Web Push certificates -> Generate key pair, then
// paste that key below as VAPID_KEY. Without it this silently no-ops —
// the in-app bell and icon badge (notifications.js) still work fine.

const Push = {
  VAPID_KEY: "", // <-- paste the Web Push certificate key here

  els: {},
  foregroundHandlerAttached: false,

  init() {
    this.els = {
      studentBtn: document.getElementById("studentEnableNotifBtn"),
      teacherBtn: document.getElementById("teacherEnableNotifBtn"),
      adminBtn: document.getElementById("adminEnableNotifBtn"),
    };

    [this.els.studentBtn, this.els.teacherBtn, this.els.adminBtn].forEach((btn) => {
      if (btn) btn.addEventListener("click", () => this.enable(btn));
    });
    this.syncButtonVisibility();

    if (this.supported() && Notification.permission === "granted") {
      // Already granted on an earlier visit — keep the token current
      // without asking again.
      this.registerToken();
    }
  },

  supported() {
    return (
      !!this.VAPID_KEY &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      typeof firebase !== "undefined" &&
      firebase.messaging &&
      (typeof firebase.messaging.isSupported !== "function" || firebase.messaging.isSupported())
    );
  },

  syncButtonVisibility() {
    const granted = this.supported() && Notification.permission === "granted";
    [this.els.studentBtn, this.els.teacherBtn, this.els.adminBtn].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle("hidden", !this.supported() || granted);
    });
  },

  async enable(triggerBtn) {
    if (!this.supported()) return;
    if (triggerBtn) triggerBtn.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await this.registerToken();
    } catch (err) {
      console.warn("Could not enable notifications:", err);
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
      this.syncButtonVisibility();
    }
  },

  async registerToken() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: this.VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) return;

      const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
      await db.collection("deviceTokens").doc(token).set({
        token,
        role: user.role || "unknown",
        username: user.username || null,
        grade: user.grade || null,
        section: user.section || null,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (!this.foregroundHandlerAttached) {
        this.foregroundHandlerAttached = true;
        messaging.onMessage((payload) => {
          const title = (payload.notification && payload.notification.title) || "Testify";
          const body = (payload.notification && payload.notification.body) || "";
          try {
            new Notification(title, { body, icon: "icons/apple-touch-icon.png" });
          } catch (err) { /* some browsers restrict this to the SW — background handler already covers those */ }
          // The bell/badge already update live from Firestore regardless —
          // this is purely so a foreground tab also gets the OS-style banner.
        });
      }
    } catch (err) {
      console.warn("Could not register for push notifications:", err);
    }
  },

  // Called on login/role switch so a re-used device's token stays
  // tagged with whoever is actually using it right now.
  refreshIdentity() {
    if (this.supported() && Notification.permission === "granted") this.registerToken();
  },
};
