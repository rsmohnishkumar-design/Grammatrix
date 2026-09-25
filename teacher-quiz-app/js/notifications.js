// Bell icon in the student, teacher and admin navbars. Open/close is
// already handled generically by the [data-kebab-btn] wiring in
// issues.js (each panel is a .kebab-dropdown) — this file only
// computes what should be listed and paints the badge count.
//
// This also mirrors the unread count onto the installed app's home
// screen icon via the Badging API (navigator.setAppBadge) — but that
// only works while this page's JS is actually running (foreground or
// a background tab), same as everything else here. Getting the icon
// bubble to update — or a banner to appear — while the app is fully
// closed needs a real push (see js/push.js and service-worker.js),
// since a closed tab runs no JS at all.

const Notifications = {
  els: {},
  rooms: [],
  roomsUnsub: null,
  tickInterval: null,
  lastItems: { student: [], teacher: [], admin: [] },

  SOON_MS: 24 * 60 * 60 * 1000, // "due soon" window

  init() {
    this.els = {
      studentBellBtn: document.getElementById("studentBellBtn"),
      studentPanel: document.getElementById("studentBellPanel"),
      studentBadge: document.getElementById("studentBellBadge"),
      teacherBellBtn: document.getElementById("teacherBellBtn"),
      teacherPanel: document.getElementById("teacherBellPanel"),
      teacherBadge: document.getElementById("teacherBellBadge"),
      adminBellBtn: document.getElementById("adminBellBtn"),
      adminPanel: document.getElementById("adminBellPanel"),
      adminBadge: document.getElementById("adminBellBadge"),
    };

    // Opening the bell clears its badge — it's an unread count, not a
    // count of everything currently pending. It reappears only once the
    // underlying list actually changes (see markSeen/paint below).
    if (this.els.studentBellBtn) this.els.studentBellBtn.addEventListener("click", () => this.markSeen("student"));
    if (this.els.teacherBellBtn) this.els.teacherBellBtn.addEventListener("click", () => this.markSeen("teacher"));
    if (this.els.adminBellBtn) this.els.adminBellBtn.addEventListener("click", () => this.markSeen("admin"));

    // Admin can act on a notification directly instead of having to find
    // the room by hand in "Every room" below.
    if (this.els.adminPanel) {
      this.els.adminPanel.addEventListener("click", (e) => {
        const item = e.target.closest("[data-notif-room]");
        if (!item) return;
        const roomId = item.dataset.notifRoom;
        if (typeof Admin !== "undefined" && Admin.editingRoomId !== roomId) {
          Admin.toggleEditRoom(roomId);
        }
        const row = document.querySelector(`[data-edit-room="${CSS.escape(roomId)}"]`);
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

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
    this.paint("student", this.els.studentPanel, this.els.studentBadge, items, "No tests waiting and nothing due soon.", user);
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
        items.push({ icon: "🔒", text: `${label} has expired — reset & resend when ready.`, roomId: r.id });
      } else if (dueMs - now <= this.SOON_MS) {
        items.push({ icon: "⏰", text: `${label} closes ${new Date(dueMs).toLocaleString()}.`, roomId: r.id });
      }
    });
    this.paint(role, panel, badge, items, "Nothing due soon or expired.");
  },

  // Per-role (and per-class for students, since two students on the
  // same device would otherwise share one "seen" state) key for what
  // was already shown the last time the bell was opened.
  seenKey(role, user) {
    if (role === "student") return `tq_notif_seen_student_${user.grade}_${String(user.section || "").toLowerCase()}`;
    return `tq_notif_seen_${role}`;
  },

  paint(role, panel, badge, items, emptyText, user) {
    this.lastItems[role] = items;
    const signature = JSON.stringify(items.map((it) => it.text));
    let seenSignature = "";
    try { seenSignature = localStorage.getItem(this.seenKey(role, user || {})) || ""; } catch (err) { /* ignore */ }
    const unseen = signature === seenSignature ? 0 : items.length;

    if (badge) {
      if (unseen > 0) {
        badge.textContent = String(unseen);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
    this.syncOsBadge(unseen);

    const clickable = role === "admin";
    panel.innerHTML = items.length
      ? items.map((it) => {
          const attr = clickable && it.roomId ? ` data-notif-room="${it.roomId}"` : "";
          const cls = clickable && it.roomId ? " notif-item-clickable" : "";
          return `<div class="notif-item${cls}"${attr}>${it.icon} ${escapeHtml(it.text)}</div>`;
        }).join("")
      : `<p class="muted" style="padding:10px 12px">${emptyText}</p>`;
  },

  // Chrome/Edge (Android, desktop, ChromeOS) show this as a small red
  // count on the installed app's icon — Safari and Firefox don't support
  // it and silently no-op here, which is fine, the in-app bell still works.
  syncOsBadge(unseen) {
    if (!navigator.setAppBadge || !navigator.clearAppBadge) return;
    if (unseen > 0) {
      navigator.setAppBadge(unseen).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  },

  markSeen(role) {
    const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
    const items = this.lastItems[role] || [];
    const signature = JSON.stringify(items.map((it) => it.text));
    try { localStorage.setItem(this.seenKey(role, user), signature); } catch (err) { /* ignore */ }
    const badge = role === "student" ? this.els.studentBadge : role === "teacher" ? this.els.teacherBadge : this.els.adminBadge;
    if (badge) badge.classList.add("hidden");
    this.syncOsBadge(0);
  },
};
