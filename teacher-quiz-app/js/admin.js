// Admin overview room (login code 2708). Read-only look at every room,
// login and score in the whole app, with a delete button on each —
// deleting removes the Firestore doc, which is the same source every
// student/teacher view reads from, so it disappears for them too.

const Admin = {
  els: {},
  roomsUnsub: null,
  loginsUnsub: null,
  scoresUnsub: null,
  issuesUnsub: null,

  rooms: [],
  editingRoomId: null,
  editQuestions: [],

  init() {
    this.els = {
      roomsList: document.getElementById("adminRoomsList"),
      loginsList: document.getElementById("adminLoginsList"),
      scoresList: document.getElementById("adminScoresList"),
      issuesList: document.getElementById("adminIssuesList"),
    };

    this.els.roomsList.addEventListener("click", (e) => this.handleRoomsClick(e));
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
    this.els.issuesList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete-issue]");
      if (!btn) return;
      this.deleteIssue(btn.dataset.deleteIssue);
    });
  },

  // Only subscribed while the admin room is actually open — stop() on
  // logout tears these down again.
  start() {
    this.stop();
    this.roomsUnsub = db.collection("rooms").onSnapshot((snap) => this.renderRooms(snap));
    this.loginsUnsub = db.collection("logins").orderBy("ts", "desc").limit(200).onSnapshot((snap) => this.renderLogins(snap));
    this.scoresUnsub = db.collection("scores").orderBy("ts", "desc").limit(200).onSnapshot((snap) => this.renderScores(snap));
    this.issuesUnsub = db.collection("issues").orderBy("ts", "desc").limit(200).onSnapshot((snap) => this.renderIssues(snap));
  },

  stop() {
    if (this.roomsUnsub) { this.roomsUnsub(); this.roomsUnsub = null; }
    if (this.loginsUnsub) { this.loginsUnsub(); this.loginsUnsub = null; }
    if (this.scoresUnsub) { this.scoresUnsub(); this.scoresUnsub = null; }
    if (this.issuesUnsub) { this.issuesUnsub(); this.issuesUnsub = null; }
    this.editingRoomId = null;
    this.editQuestions = [];
  },

  handleRoomsClick(e) {
    const delBtn = e.target.closest("button[data-delete-room]");
    if (delBtn) { this.deleteRoom(delBtn.dataset.deleteRoom); return; }

    const editBtn = e.target.closest("button[data-edit-room]");
    if (editBtn) { this.toggleEditRoom(editBtn.dataset.editRoom); return; }

    const removeQBtn = e.target.closest("button[data-remove-edit-q]");
    if (removeQBtn) {
      this.editQuestions.splice(Number(removeQBtn.dataset.removeEditQ), 1);
      this.renderRoomsList();
      return;
    }

    if (e.target.closest("[data-admin-add-q]")) { this.addEditQuestion(); return; }
    if (e.target.closest("[data-admin-save-edit]")) { this.saveRoomEdits(); return; }
  },

  renderRooms(snap) {
    this.rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.renderRoomsList();
  },

  renderRoomsList() {
    if (!this.rooms.length) {
      this.els.roomsList.innerHTML = '<p class="muted">No rooms yet.</p>';
      return;
    }
    this.els.roomsList.innerHTML = this.rooms.map((r) => {
      const n = Array.isArray(r.questions) ? r.questions.length : 0;
      const sent = r.sentAt && r.sentAt.toDate ? r.sentAt.toDate().toLocaleString() : "—";
      const isEditing = this.editingRoomId === r.id;
      return `
        <div class="admin-room-block">
          <div class="admin-row">
            <div class="admin-row-main">
              <strong>${escapeHtml(roomLabel(r.grade, r.section, r.subject))}</strong>
              <span class="muted">${n} question${n === 1 ? "" : "s"} &bull; sent ${escapeHtml(sent)}</span>
            </div>
            <div class="admin-row-actions">
              <button class="btn secondary small" data-edit-room="${r.id}">${isEditing ? "✕ Close" : "✏️ Edit"}</button>
              <button class="btn danger small" data-delete-room="${r.id}">🗑️ Delete</button>
            </div>
          </div>
          ${isEditing ? this.renderRoomEditor() : ""}
        </div>`;
    }).join("");
  },

  toggleEditRoom(roomId) {
    if (this.editingRoomId === roomId) {
      this.editingRoomId = null;
      this.editQuestions = [];
    } else {
      const room = this.rooms.find((r) => r.id === roomId);
      this.editingRoomId = roomId;
      this.editQuestions = room && Array.isArray(room.questions) ? JSON.parse(JSON.stringify(room.questions)) : [];
    }
    this.renderRoomsList();
  },

  renderRoomEditor() {
    const list = this.editQuestions.length
      ? this.editQuestions.map((q, i) => `
          <div class="question-block">
            <button class="remove-q" data-remove-edit-q="${i}" title="Remove question">✕</button>
            <div class="qn">${i + 1}. ${escapeHtml(q.questionText)}</div>
            <div class="qa">Answer: ${escapeHtml(q.correctAnswer)}</div>
          </div>
        `).join("")
      : '<p class="muted">No questions — add one below.</p>';

    return `
      <div class="admin-room-editor">
        <div>${list}</div>
        <div class="manual-form">
          <label class="field-label">Question</label>
          <input id="adminEditQuestion" placeholder="e.g. What force keeps planets in orbit?">
          <label class="field-label">Correct answer</label>
          <input id="adminEditCorrect" placeholder="e.g. Gravity">
          <label class="field-label">Wrong option</label>
          <input id="adminEditWrong1" placeholder="e.g. Magnetism">
          <label class="field-label">Wrong option</label>
          <input id="adminEditWrong2" placeholder="e.g. Friction">
          <label class="field-label">Wrong option</label>
          <input id="adminEditWrong3" placeholder="e.g. Momentum">
          <div class="btn-row">
            <button class="btn secondary" data-admin-add-q>➕ Add question</button>
            <button class="btn primary" data-admin-save-edit>💾 Save changes</button>
          </div>
          <div id="adminEditStatus" class="status"></div>
        </div>
      </div>`;
  },

  addEditQuestion() {
    const questionText = document.getElementById("adminEditQuestion").value.trim();
    const correct = document.getElementById("adminEditCorrect").value.trim();
    const wrongs = [
      document.getElementById("adminEditWrong1").value.trim(),
      document.getElementById("adminEditWrong2").value.trim(),
      document.getElementById("adminEditWrong3").value.trim(),
    ];
    const statusEl = document.getElementById("adminEditStatus");

    if (!questionText || !correct || wrongs.some((w) => !w)) {
      statusEl.textContent = "Fill in the question, the correct answer, and all 3 wrong options.";
      statusEl.className = "status error";
      return;
    }

    const options = shuffle([correct, ...wrongs]);
    options.push("I don't know");
    this.editQuestions.push({ questionText, options, correctAnswer: correct });
    this.renderRoomsList();
  },

  async saveRoomEdits() {
    const room = this.rooms.find((r) => r.id === this.editingRoomId);
    if (!room) return;
    try {
      await db.collection("rooms").doc(room.id).set({
        grade: room.grade,
        section: room.section,
        subject: room.subject,
        questions: this.editQuestions,
        sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      this.editingRoomId = null;
      this.editQuestions = [];
      this.renderRoomsList();
    } catch (err) {
      console.error(err);
      const statusEl = document.getElementById("adminEditStatus");
      if (statusEl) {
        statusEl.textContent = "Could not save changes.";
        statusEl.className = "status error";
      }
    }
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
      const inProgress = r.status === "in_progress" ? ` <span class="susp-flag">⏳ Didn't finish</span>` : "";
      return `
        <div class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.username || "")} &mdash; ${r.score}/${r.total}${flag}${left}${inProgress}</strong>
            <span class="muted">Grade ${escapeHtml(String(r.grade || "—"))} &bull; Sec ${escapeHtml(String(r.section || "—"))} &bull; ${escapeHtml(r.subject || "—")} &bull; ${escapeHtml(when)}</span>
          </div>
          <button class="btn danger small" data-delete-score="${r.id}" title="Delete this score">🗑️</button>
        </div>`;
    }).join("");
  },

  renderIssues(snap) {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!rows.length) {
      this.els.issuesList.innerHTML = '<p class="muted">No issues reported.</p>';
      return;
    }
    this.els.issuesList.innerHTML = rows.map((r) => {
      const when = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString() : "Just now";
      const where = r.role === "student" ? `Grade ${escapeHtml(String(r.grade || "—"))} &bull; Sec ${escapeHtml(String(r.section || "—"))}` : (r.role === "teacher" ? "Teacher" : escapeHtml(r.role || ""));
      return `
        <div class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.message || "")}</strong>
            <span class="muted">${escapeHtml(r.username || "Unknown")} &bull; ${where} &bull; ${escapeHtml(when)}</span>
          </div>
          <button class="btn danger small" data-delete-issue="${r.id}" title="Delete this report">🗑️</button>
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

  async deleteIssue(id) {
    try {
      await db.collection("issues").doc(id).delete();
    } catch (err) {
      console.error(err);
      window.alert("Could not delete that report.");
    }
  },
};
