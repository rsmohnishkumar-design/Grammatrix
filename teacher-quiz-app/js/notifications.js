// Bell icon in the student, teacher and admin navbars. Open/close is
// already handled generically by the [data-kebab-btn] wiring in
// issues.js (each panel is a .kebab-dropdown) — this file only
// computes what should be listed and paints the badge count.
//
// Nothing here is a real OS/push notification (that needs Firebase
// Cloud Messaging, a service worker push handler, and the student
// granting permission — well beyond a school-project test app). These
// are in-app only: a badge + panel that only show up while someone has
// the page open, derived live from the "rooms" collection every time
// it changes.

const Notifications = {
  els: {},
  rooms: [],
  roomsUnsub: null,
  tickInterval: null,

  SOON_MS: 24 * 60 * 60 * 1000, // "due soon" window

  init() {
    this.els = {
      studentPanel: document.getElementById("studentBellPanel"),
      studentBadge: document.getElementById("studentBellBadge"),
      teacherPanel: document.getElementById("teacherBellPanel"),
      teacherBadge: document.getElementById("teacherBellBadge"),
      adminPanel: document.getElementById("adminBellPanel"),
      adminBadge: document.getElementById("adminBellBadge"),
    };

    this.roomsUnsub = db.collection("rooms").onSnapshot((snap) => {
      this.rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.render();
    });

    // A test can cross "due soon" or "expired" purely because the clock
    // ticked, with no Firestore write to trigger a fresh snapshot.
    this.tickInterval = setInterval(() => this.render(), 60000);
  },

  render() {
    const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
    if (user.role === "student") this.renderStudent(user);
    if (user.role === "teacher" || user.role === "admin") this.renderStaff(user.role);
  },

  renderStudent(user) {
    if (!this.els.studentPanel) return;
    const now = Date.now();
    const mine = this.rooms.filter((r) =>
      Array.isArray(r.questions) && r.questions.length &&
      String(r.grade) === String(user.grade) &&
      String(r.section || "").toLowerCase() === String(user.section || "").toLowerCase() &&
      (!r.dueAt || toMillis(r.dueAt) > now)
    );
    const items = [];
    mine.forEach((r) => {
      items.push({ icon: "🆕", text: `${r.subject} is available to take.` });
      const dueMs = toMillis(r.dueAt);
      if (dueMs && dueMs - now <= this.SOON_MS) {
        items.push({ icon: "⏰", text: `${r.subject} closes ${new Date(dueMs).toLocaleString()}.` });
      }
    });
    this.paint(this.els.studentPanel, this.els.studentBadge, items, "No tests waiting and nothing due soon.");
  },

  renderStaff(role) {
    const panel = role === "teacher" ? this.els.teacherPanel : this.els.adminPanel;
    const badge = role === "teacher" ? this.els.teacherBadge : this.els.adminBadge;
    if (!panel) return;
    const now = Date.now();
    const items = [];
    this.rooms.forEach((r) => {
      if (!Array.isArray(r.questions) || !r.questions.length || !r.dueAt) return;
      const dueMs = toMillis(r.dueAt);
      const label = roomLabel(r.grade, r.section, r.subject);
      if (dueMs <= now) {
        items.push({ icon: "🔒", text: `${label} has expired — reset & resend when ready.` });
      } else if (dueMs - now <= this.SOON_MS) {
        items.push({ icon: "⏰", text: `${label} closes ${new Date(dueMs).toLocaleString()}.` });
      }
    });
    this.paint(panel, badge, items, "Nothing due soon or expired.");
  },

  paint(panel, badge, items, emptyText) {
    if (badge) {
      if (items.length) {
        badge.textContent = String(items.length);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
    panel.innerHTML = items.length
      ? items.map((it) => `<div class="notif-item">${it.icon} ${escapeHtml(it.text)}</div>`).join("")
      : `<p class="muted" style="padding:10px 12px">${emptyText}</p>`;
  },
};
