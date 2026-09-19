// Admin overview room (login code 2708). Read-only look at every room,
// login and score in the whole app, with a delete button on each —
// deleting removes the Firestore doc, which is the same source every
// student/teacher view reads from, so it disappears for them too.

const Admin = {
  els: {},
  roomsUnsub: null,
  loginsUnsub: null,
  scoresUnsub: null,

  init() {
    this.els = {
      roomsList: document.getElementById("adminRoomsList"),
      loginsList: document.getElementById("adminLoginsList"),
      scoresList: document.getElementById("adminScoresList"),
    };

    this.els.roomsList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-room]");
      if (!btn) return;
      this.deleteRoom(btn.dataset.deleteRoom);
    });
    this.els.loginsList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-login]");
      if (!btn) return;
      this.deleteLogin(btn.dataset.deleteLogin);
    });
    this.els.scoresList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-score]");
      if (!btn) return;
      this.deleteScore(btn.dataset.deleteScore);
    });
  },

  // Only subscribed while the admin room is actually open — stop() on
  // logout tears these down again.
  start() {
    this.stop();
    this.roomsUnsub = db.collection("rooms").onSnapshot((snap) => this.renderRooms(snap));
    this.loginsUnsub = db.collection("logins").orderBy("ts", "desc").limit(200).onSnapshot((snap) => this.renderLogins(snap));
    this.scoresUnsub = db.collection("scores").orderBy("ts", "desc").limit(200).onSnapshot((snap) => this.renderScores(snap));
  },

  stop() {
    if (this.roomsUnsub) { this.roomsUnsub(); this.roomsUnsub = null; }
    if (this.loginsUnsub) { this.loginsUnsub(); this.loginsUnsub = null; }
    if (this.scoresUnsub) { this.scoresUnsub(); this.scoresUnsub = null; }
  },

  renderRooms(snap) {
    const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!rooms.length) {
      this.els.roomsList.innerHTML = '<p class="muted">No rooms yet.</p>';
      return;
    }
    this.els.roomsList.innerHTML = rooms.map((r) => {
      const n = Array.isArray(r.questions) ? r.questions.length : 0;
      const sent = r.sentAt && r.sentAt.toDate ? r.sentAt.toDate().toLocaleString() : "—";
      return `
        <div class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(roomLabel(r.grade, r.section, r.subject))}</strong>
            <span class="muted">${n} question${n === 1 ? "" : "s"} &bull; sent ${escapeHtml(sent)}</span>
          </div>
          <button class="btn danger small" data-delete-room="${r.id}">🗑️ Delete</button>
        </div>`;
    }).join("");
  },

  renderLogins(snap) {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!rows.length) {
      this.els.loginsList.innerHTML = '<p class="muted">No logins yet.</p>';
      return;
    }
    this.els.loginsList.innerHTML = rows.map((r) => {
      const when = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString() : "Just now";
      const where = r.role === "student" ? `Grade ${r.grade} &bull; Section ${r.section}` : (r.role === "admin" ? "Admin" : "Teacher");
      return `
        <div class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.username || "")}</strong>
            <span class="muted">${where} &bull; ${escapeHtml(when)}</span>
          </div>
          <button class="btn danger small" data-delete-login="${r.id}" title="Delete this login">🗑️</button>
        </div>`;
    }).join("");
  },

  renderScores(snap) {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!rows.length) {
      this.els.scoresList.innerHTML = '<p class="muted">No scores yet.</p>';
      return;
    }
    this.els.scoresList.innerHTML = rows.map((r) => {
      const when = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString() : "Just now";
      const flag = r.suspicious > 0 ? ` <span class="susp-flag">⚠️ ${r.suspicious}</span>` : "";
      const left = r.leftEarly ? ` <span class="susp-flag">🚪 Left early</span>` : "";
      return `
        <div class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.username || "")} &mdash; ${r.score}/${r.total}${flag}${left}</strong>
            <span class="muted">Grade ${escapeHtml(String(r.grade || "—"))} &bull; Sec ${escapeHtml(String(r.section || "—"))} &bull; ${escapeHtml(r.subject || "—")} &bull; ${escapeHtml(when)}</span>
          </div>
          <button class="btn danger small" data-delete-score="${r.id}" title="Delete this score">🗑️</button>
        </div>`;
    }).join("");
  },

  async deleteRoom(id) {
    if (!window.confirm("Delete this room? Students will stop seeing this test immediately.")) return;
    try {
      await db.collection("rooms").doc(id).delete();
    } catch (err) {
      console.error(err);
      window.alert("Could not delete that room.");
    }
  },

  async deleteLogin(id) {
    try {
      await db.collection("logins").doc(id).delete();
    } catch (err) {
      console.error(err);
      window.alert("Could not delete that login.");
    }
  },

  async deleteScore(id) {
    if (!window.confirm("Delete this score record? This can't be undone, and it will disappear from that student's \"Test attended\" list too.")) return;
    try {
      await db.collection("scores").doc(id).delete();
    } catch (err) {
      console.error(err);
      window.alert("Could not delete that score.");
    }
  },
};
