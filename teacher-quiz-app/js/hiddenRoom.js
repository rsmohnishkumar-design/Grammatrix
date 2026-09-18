const HiddenRoom = {
  questions: [],
  mode: "list",
  els: {},

  init() {
    this.els = {
      photoInput: document.getElementById("photoInput"),
      generateBtn: document.getElementById("generateBtn"),
      ocrStatus: document.getElementById("ocrStatus"),
      questionsArea: document.getElementById("questionsArea"),
      modeListBtn: document.getElementById("modeListBtn"),
      modeInteractiveBtn: document.getElementById("modeInteractiveBtn"),
      sendBtn: document.getElementById("sendBtn"),
      clearLiveBtn: document.getElementById("clearLiveBtn"),
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

    this.els.generateBtn.addEventListener("click", () => this.handleGenerate());
    this.els.modeListBtn.addEventListener("click", () => this.setMode("list"));
    this.els.modeInteractiveBtn.addEventListener("click", () => this.setMode("interactive"));
    this.els.sendBtn.addEventListener("click", () => this.sendToChildren());
    this.els.clearLiveBtn.addEventListener("click", () => this.clearLiveQuiz());
    this.els.addManualBtn.addEventListener("click", () => this.toggleManualForm());
    this.els.manualAddBtn.addEventListener("click", () => this.addManualQuestion());
    this.els.manualCancelBtn.addEventListener("click", () => this.hideManualForm());

    this.renderQuestions();
    this.listenScoreboard();
    this.listenLiveStatus();
  },

  setStatus(msg, kind) {
    this.els.ocrStatus.textContent = msg;
    this.els.ocrStatus.className = "status" + (kind ? " " + kind : "");
  },

  async handleGenerate() {
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

      const newQuestions = generateQuestions(text);
      if (!newQuestions.length) {
        this.setStatus("Couldn't build questions from that text — try a page with fuller sentences.", "error");
        return;
      }

      this.questions = this.questions.concat(newQuestions);
      this.setStatus(`Added ${newQuestions.length} questions (${this.questions.length} total).`, "success");
      this.renderQuestions();
    } catch (err) {
      console.error(err);
      this.setStatus("Something went wrong reading that file. Try again.", "error");
    } finally {
      this.els.generateBtn.disabled = false;
    }
  },

  async uploadFiles(files) {
    for (const file of files) {
      try {
        const path = `uploads/${Date.now()}_${file.name}`;
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
    if (!this.questions.length) {
      this.els.sendStatus.textContent = "Add or generate at least one question first.";
      this.els.sendStatus.className = "status error";
      return;
    }
    this.els.sendBtn.disabled = true;
    try {
      await db.collection("quiz").doc("current").set({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        questions: this.questions,
        sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      this.els.sendStatus.textContent = `Sent ${this.questions.length} questions! Students will see it now.`;
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
    this.els.clearLiveBtn.disabled = true;
    try {
      await db.collection("quiz").doc("current").delete();
      this.els.sendStatus.textContent = "Live quiz stopped — students will stop seeing it.";
      this.els.sendStatus.className = "status";
    } catch (err) {
      console.error(err);
      this.els.sendStatus.textContent = "Could not stop the quiz — check your Firebase setup.";
      this.els.sendStatus.className = "status error";
    } finally {
      this.els.clearLiveBtn.disabled = false;
    }
  },

  listenLiveStatus() {
    db.collection("quiz").doc("current").onSnapshot(
      (doc) => {
        const banner = this.els.liveStatusBanner;
        if (doc.exists && Array.isArray(doc.data().questions) && doc.data().questions.length) {
          banner.textContent = `🟢 Live now — ${doc.data().questions.length} questions are with your students`;
          banner.className = "live-banner live";
        } else {
          banner.textContent = "⚪ No live quiz right now";
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
    db.collection("logins").orderBy("ts", "desc").limit(50).onSnapshot((snap) => {
      if (snap.empty) {
        this.els.loginsTable.innerHTML = '<p class="muted">No logins yet.</p>';
        return;
      }
      const rows = snap.docs
        .map((d) => d.data())
        .map((r) => `<tr><td>${escapeHtml(r.username || "")}</td><td>${r.role || ""}</td></tr>`)
        .join("");
      this.els.loginsTable.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>`;
    });

    db.collection("scores").orderBy("ts", "desc").limit(50).onSnapshot((snap) => {
      if (snap.empty) {
        this.els.scoresTable.innerHTML = '<p class="muted">No scores yet.</p>';
        return;
      }
      const rows = snap.docs
        .map((d) => d.data())
        .map((r) => `<tr><td>${escapeHtml(r.username || "")}</td><td>${r.score}/${r.total}</td></tr>`)
        .join("");
      this.els.scoresTable.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
    });
  },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
