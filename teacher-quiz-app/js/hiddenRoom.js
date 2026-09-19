// Builds a room id from grade + section + subject. Shared shape used by
// both the teacher (Hidden Room) and student (quiz.js) sides so a test
// sent to "Grade 7 / A / Biology" is found by students with exactly that
// grade + section, grouped for them under the "Biology" subject.
function makeRoomId(grade, section, subject) {
  const clean = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `g${clean(grade)}-s${clean(section)}-${clean(subject)}`;
}

function roomLabel(grade, section, subject) {
  return `Grade ${grade} • Section ${String(section).toUpperCase()} • ${subject}`;
}

const HiddenRoom = {
  questions: [],
  mode: "list",
  els: {},

  grade: null,
  section: "",
  subject: "",
  roomId: null,

  liveUnsub: null,
  loginsUnsub: null,
  scoresUnsub: null,
  globalStatsUnsub: null,

  init() {
    this.els = {
      gradeMenu: document.getElementById("gradeMenu"),
      roomEmptyCard: document.getElementById("roomEmptyCard"),
      roomPanel: document.getElementById("roomPanel"),
      roomGradeDisplay: document.getElementById("roomGradeDisplay"),
      roomSectionInput: document.getElementById("roomSectionInput"),
      roomSubjectInput: document.getElementById("roomSubjectInput"),
      roomStatus: document.getElementById("roomStatus"),
      roomContent: document.getElementById("roomContent"),
      sidebarStats: document.getElementById("sidebarStats"),

      photoInput: document.getElementById("photoInput"),
      generateBtn: document.getElementById("generateBtn"),
      ocrStatus: document.getElementById("ocrStatus"),
      questionsArea: document.getElementById("questionsArea"),
      modeListBtn: document.getElementById("modeListBtn"),
      modeInteractiveBtn: document.getElementById("modeInteractiveBtn"),
      sendBtn: document.getElementById("sendBtn"),
      clearLiveBtn: document.getElementById("clearLiveBtn"),
      resetQuestionsBtn: document.getElementById("resetQuestionsBtn"),
      questionCountInput: document.getElementById("questionCountInput"),
      sendStatus: document.getElementById("sendStatus"),
      loginsTable: document.getElementById("loginsTable"),
      scoresTable: document.getElementById("scoresTable"),
      liveStatusBanner: document.getElementById("liveStatusBanner"),
      addManualBtn: document.getElementById("addManualBtn"),
      manualForm: document.getElementById("manualForm"),
      manualQuestion: document.getElementById("manualQuestion"),
      manualCorrect: document.getElementById("manualCorrect"),
      manualWrong1: document.getElementById("manualWrong1"),
      manualWrong2: document.getElementById("manualWrong2"),
      manualWrong3: document.getElementById("manualWrong3"),
      manualAddBtn: document.getElementById("manualAddBtn"),
      manualCancelBtn: document.getElementById("manualCancelBtn"),
      manualStatus: document.getElementById("manualStatus"),
    };

    this.buildGradeMenu();

    this.els.roomSectionInput.addEventListener("change", () => this.updateRoom());
    this.els.roomSubjectInput.addEventListener("change", () => this.updateRoom());
    this.els.roomSectionInput.addEventListener("blur", () => this.updateRoom());
    this.els.roomSubjectInput.addEventListener("blur", () => this.updateRoom());

    this.els.generateBtn.addEventListener("click", () => this.handleGenerate());
    this.els.modeListBtn.addEventListener("click", () => this.setMode("list"));
    this.els.modeInteractiveBtn.addEventListener("click", () => this.setMode("interactive"));
    this.els.sendBtn.addEventListener("click", () => this.sendToChildren());
    this.els.clearLiveBtn.addEventListener("click", () => this.clearLiveQuiz());
    this.els.resetQuestionsBtn.addEventListener("click", () => this.resetQuestions());
    this.els.addManualBtn.addEventListener("click", () => this.toggleManualForm());
    this.els.manualAddBtn.addEventListener("click", () => this.addManualQuestion());
    this.els.manualCancelBtn.addEventListener("click", () => this.hideManualForm());

    this.listenGlobalStats();
  },

  buildGradeMenu() {
    const menu = this.els.gradeMenu;
    menu.innerHTML = "";
    for (let g = 1; g <= 12; g++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grade-menu-item";
      btn.dataset.grade = g;
      btn.innerHTML = `<span class="gmi-badge">${g}</span> Grade ${g}`;
      btn.addEventListener("click", () => this.selectGrade(g));
      menu.appendChild(btn);
    }
  },

  selectGrade(grade) {
    this.grade = grade;
    Array.from(this.els.gradeMenu.querySelectorAll(".grade-menu-item")).forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.grade) === grade);
    });

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(`tq_grade_pref_${grade}`) || "{}");
    } catch (err) { /* ignore */ }
    this.section = saved.section || "";
    this.subject = saved.subject || "";

    this.els.roomGradeDisplay.value = `Grade ${grade}`;
    this.els.roomSectionInput.value = this.section;
    this.els.roomSubjectInput.value = this.subject;

    this.els.roomEmptyCard.classList.add("hidden");
    this.els.roomPanel.classList.remove("hidden");

    this.updateRoom();
  },

  updateRoom() {
    if (!this.grade) return;
    this.section = this.els.roomSectionInput.value.trim();
    this.subject = this.els.roomSubjectInput.value.trim();

    if (!this.section || !this.subject) {
      this.roomId = null;
      this.els.roomContent.classList.add("hidden");
      this.els.roomStatus.textContent = "Enter a section and subject above to open this room — students won't see anything until both are filled in.";
      this.els.roomStatus.className = "status";
      this.unsubscribeRoom();
      return;
    }

    const newRoomId = makeRoomId(this.grade, this.section, this.subject);
    if (newRoomId === this.roomId) return;

    this.roomId = newRoomId;
    try {
      localStorage.setItem(`tq_grade_pref_${this.grade}`, JSON.stringify({ section: this.section, subject: this.subject }));
    } catch (err) { /* ignore */ }

    this.els.roomStatus.textContent = `🏷️ ${roomLabel(this.grade, this.section, this.subject)}`;
    this.els.roomStatus.className = "status success";
    this.els.roomContent.classList.remove("hidden");

    this.loadDraft();
    this.renderQuestions();
    this.hideManualForm();
    this.els.photoInput.value = "";
    this.els.ocrStatus.textContent = "";
    this.els.ocrStatus.className = "status";
    this.els.sendStatus.textContent = "";
    this.els.sendStatus.className = "status";

    this.listenLiveStatus();
    this.listenScoreboard();
  },

  unsubscribeRoom() {
    if (this.liveUnsub) { this.liveUnsub(); this.liveUnsub = null; }
    if (this.loginsUnsub) { this.loginsUnsub(); this.loginsUnsub = null; }
    if (this.scoresUnsub) { this.scoresUnsub(); this.scoresUnsub = null; }
  },

  // Questions live only in memory otherwise — a page refresh (or the
  // browser tab closing) would silently wipe out everything a teacher
  // built for this specific room, even while a quiz they already sent
  // is still live for students.
  loadDraft() {
    this.questions = [];
    try {
      const saved = JSON.parse(localStorage.getItem(`tq_room_draft_${this.roomId}`) || "[]");
      if (Array.isArray(saved)) this.questions = saved;
    } catch (err) {
      console.warn("Could not restore saved questions:", err);
    }
  },

  saveDraft() {
    if (!this.roomId) return;
    try {
      localStorage.setItem(`tq_room_draft_${this.roomId}`, JSON.stringify(this.questions));
    } catch (err) {
      console.warn("Could not save questions draft:", err);
    }
  },

  resetQuestions() {
    if (!this.roomId) return;
    if (this.questions.length && !window.confirm(`Remove all ${this.questions.length} question(s)? This can't be undone.`)) {
      return;
    }
    this.questions = [];
    this.saveDraft();
    this.renderQuestions();
    this.els.photoInput.value = "";
    this.hideManualForm();
    this.els.ocrStatus.textContent = "";
    this.els.ocrStatus.className = "status";
    this.els.sendStatus.textContent = "Questions reset.";
    this.els.sendStatus.className = "status";
  },

  setStatus(msg, kind) {
    this.els.ocrStatus.textContent = msg;
    this.els.ocrStatus.className = "status" + (kind ? " " + kind : "");
  },

  async handleGenerate() {
    if (!this.roomId) return;
    const files = Array.from(this.els.photoInput.files || []);
    if (!files.length) {
      this.setStatus("Add at least one photo or PDF first.", "error");
      return;
    }

    this.els.generateBtn.disabled = true;
    this.uploadFiles(files);

    try {
      const text = await extractTextFromFiles(files, (msg) => this.setStatus(msg));
      if (!text || text.trim().length < 20) {
        this.setStatus("Couldn't read enough text from that — try a clearer photo or a PDF with more text.", "error");
        return;
      }

      const requested = Math.min(50, Math.max(1, parseInt(this.els.questionCountInput.value, 10) || 8));
      this.els.questionCountInput.value = requested;
      const newQuestions = generateQuestions(text, requested);
      if (!newQuestions.length) {
        this.setStatus("Couldn't build questions from that text — try a page with fuller sentences.", "error");
        return;
      }

      this.questions = this.questions.concat(newQuestions);
      this.saveDraft();
      this.setStatus(`Added ${newQuestions.length} questions (${this.questions.length} total).`, "success");
      this.renderQuestions();
    } catch (err) {
      console.error(err);
      this.setStatus(`⚠️ ${err.message || "Something went wrong reading that file."}`, "error");
    } finally {
      this.els.generateBtn.disabled = false;
    }
  },

  async uploadFiles(files) {
    for (const file of files) {
      try {
        const path = `uploads/${this.roomId}/${Date.now()}_${file.name}`;
        await storage.ref(path).put(file);
      } catch (err) {
        console.warn("Upload failed (question generation still works offline):", err);
      }
    }
  },

  toggleManualForm() {
    this.els.manualForm.classList.toggle("hidden");
  },

  hideManualForm() {
    this.els.manualForm.classList.add("hidden");
    this.els.manualStatus.textContent = "";
    [this.els.manualQuestion, this.els.manualCorrect, this.els.manualWrong1, this.els.manualWrong2, this.els.manualWrong3]
      .forEach((el) => (el.value = ""));
  },

  addManualQuestion() {
    if (!this.roomId) return;
    const questionText = this.els.manualQuestion.value.trim();
    const correct = this.els.manualCorrect.value.trim();
    const wrongs = [this.els.manualWrong1.value.trim(), this.els.manualWrong2.value.trim(), this.els.manualWrong3.value.trim()];

    if (!questionText || !correct || wrongs.some((w) => !w)) {
      this.els.manualStatus.textContent = "Fill in the question, the correct answer, and all 3 wrong options.";
      this.els.manualStatus.className = "status error";
      return;
    }

    const options = shuffle([correct, ...wrongs]);
    options.push("I don't know");

    this.questions.push({ questionText, options, correctAnswer: correct });
    this.saveDraft();
    this.renderQuestions();

    this.els.manualStatus.textContent = "Question added.";
    this.els.manualStatus.className = "status success";
    [this.els.manualQuestion, this.els.manualCorrect, this.els.manualWrong1, this.els.manualWrong2, this.els.manualWrong3]
      .forEach((el) => (el.value = ""));
    this.els.manualQuestion.focus();
  },

  setMode(mode) {
    this.mode = mode;
    this.els.modeListBtn.classList.toggle("active", mode === "list");
    this.els.modeInteractiveBtn.classList.toggle("active", mode === "interactive");
    this.renderQuestions();
  },

  renderQuestions() {
    const area = this.els.questionsArea;
    area.innerHTML = "";

    if (!this.questions.length) {
      area.innerHTML = '<p class="muted">No questions yet — generate some from photos above, or add one below.</p>';
      return;
    }

    if (this.mode === "list") {
      this.questions.forEach((q, i) => {
        const block = document.createElement("div");
        block.className = "question-block";
        block.innerHTML = `
          <button class="remove-q" data-i="${i}" title="Remove question">✕</button>
          <div class="qn">${i + 1}. ${escapeHtml(q.questionText)}</div>
          <div class="qa">Answer: ${escapeHtml(q.correctAnswer)}</div>
        `;
        block.querySelector(".remove-q").addEventListener("click", () => {
          this.questions.splice(i, 1);
          this.saveDraft();
          this.renderQuestions();
        });
        area.appendChild(block);
      });
    } else {
      // Interactive preview: exactly what students will see, non-scoring.
      this.questions.forEach((q, i) => {
        const block = document.createElement("div");
        block.className = "question-block";
        block.innerHTML = `<div class="qn">${i + 1}. ${escapeHtml(q.questionText)}</div>`;
        const optsWrap = document.createElement("div");
        optsWrap.className = "options";
        block.appendChild(optsWrap);
        renderOptions(optsWrap, q, (opt, btn, container) => lockOptions(container, q, btn));
        area.appendChild(block);
      });
    }
  },

  async sendToChildren() {
    if (!this.roomId) return;
    if (!this.questions.length) {
      this.els.sendStatus.textContent = "Add or generate at least one question first.";
      this.els.sendStatus.className = "status error";
      return;
    }
    this.els.sendBtn.disabled = true;
    try {
      await db.collection("rooms").doc(this.roomId).set({
        grade: this.grade,
        section: this.section,
        subject: this.subject,
        questions: this.questions,
        sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      this.els.sendStatus.textContent = `Sent ${this.questions.length} questions! ${roomLabel(this.grade, this.section, this.subject)} students will see it now.`;
      this.els.sendStatus.className = "status success";
    } catch (err) {
      console.error(err);
      this.els.sendStatus.textContent = "Could not send — check your Firebase setup.";
      this.els.sendStatus.className = "status error";
    } finally {
      this.els.sendBtn.disabled = false;
    }
  },

  async clearLiveQuiz() {
    if (!this.roomId) return;
    this.els.clearLiveBtn.disabled = true;
    try {
      await db.collection("rooms").doc(this.roomId).delete();
      this.els.sendStatus.textContent = "Live test stopped — students will stop seeing it.";
      this.els.sendStatus.className = "status";
    } catch (err) {
      console.error(err);
      this.els.sendStatus.textContent = "Could not stop the test — check your Firebase setup.";
      this.els.sendStatus.className = "status error";
    } finally {
      this.els.clearLiveBtn.disabled = false;
    }
  },

  listenLiveStatus() {
    if (this.liveUnsub) this.liveUnsub();
    const roomId = this.roomId;
    this.liveUnsub = db.collection("rooms").doc(roomId).onSnapshot(
      (doc) => {
        if (roomId !== this.roomId) return; // stale listener from a room we've since left
        const banner = this.els.liveStatusBanner;
        if (doc.exists && Array.isArray(doc.data().questions) && doc.data().questions.length) {
          banner.textContent = `🟢 Live now — ${doc.data().questions.length} questions are with ${roomLabel(this.grade, this.section, this.subject)}`;
          banner.className = "live-banner live";
        } else {
          banner.textContent = "⚪ No live test right now for this room";
          banner.className = "live-banner";
        }
      },
      (err) => {
        console.error(err);
        this.els.liveStatusBanner.textContent = "⚠️ Could not check live status — check your Firebase setup.";
        this.els.liveStatusBanner.className = "live-banner error";
      }
    );
  },

  listenScoreboard() {
    if (this.loginsUnsub) this.loginsUnsub();
    if (this.scoresUnsub) this.scoresUnsub();
    const roomId = this.roomId;
    const grade = this.grade;
    const section = this.section;

    this.loginsUnsub = db.collection("logins").orderBy("ts", "desc").limit(100).onSnapshot((snap) => {
      if (roomId !== this.roomId) return;
      const rows = snap.docs
        .map((d) => d.data())
        .filter((r) => r.role === "teacher" || (String(r.grade) === String(grade) && String(r.section || "").toLowerCase() === String(section).toLowerCase()));
      if (!rows.length) {
        this.els.loginsTable.innerHTML = '<p class="muted">No logins yet for this grade &amp; section.</p>';
        return;
      }
      const html = rows
        .map((r) => `<tr><td>${escapeHtml(r.username || "")}</td><td>${r.role || ""}</td></tr>`)
        .join("");
      this.els.loginsTable.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody>${html}</tbody></table>`;
    });

    this.scoresUnsub = db.collection("scores").orderBy("ts", "desc").limit(100).onSnapshot((snap) => {
      if (roomId !== this.roomId) return;
      const rows = snap.docs.map((d) => d.data()).filter((r) => r.roomId === roomId);
      if (!rows.length) {
        this.els.scoresTable.innerHTML = '<p class="muted">No scores yet for this room.</p>';
        return;
      }
      const html = rows
        .map((r) => `<tr><td>${escapeHtml(r.username || "")}</td><td>${r.score}/${r.total}</td></tr>`)
        .join("");
      this.els.scoresTable.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Score</th></tr></thead><tbody>${html}</tbody></table>`;
    });
  },

  listenGlobalStats() {
    if (this.globalStatsUnsub) this.globalStatsUnsub();
    this.globalStatsUnsub = db.collection("logins").orderBy("ts", "desc").limit(100).onSnapshot((snap) => {
      const names = new Set(snap.docs.map((d) => d.data().username).filter(Boolean));
      this.els.sidebarStats.innerHTML = `<strong>${names.size}</strong> logins recently`;
    }, () => {
      this.els.sidebarStats.innerHTML = `<strong>—</strong> logins recently`;
    });
  },
};
