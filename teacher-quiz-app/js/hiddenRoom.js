const HiddenRoom = {
  questions: [],
  mode: "list",
  els: {},

  init() {
    this.els = {
      photoInput: document.getElementById("photoInput"),
      generateBtn: document.getElementById("generateBtn"),
      ocrStatus: document.getElementById("ocrStatus"),
      questionsCard: document.getElementById("questionsCard"),
      questionsArea: document.getElementById("questionsArea"),
      modeListBtn: document.getElementById("modeListBtn"),
      modeInteractiveBtn: document.getElementById("modeInteractiveBtn"),
      sendBtn: document.getElementById("sendBtn"),
      clearLiveBtn: document.getElementById("clearLiveBtn"),
      sendStatus: document.getElementById("sendStatus"),
      loginsTable: document.getElementById("loginsTable"),
      scoresTable: document.getElementById("scoresTable"),
    };

    this.els.generateBtn.addEventListener("click", () => this.handleGenerate());
    this.els.modeListBtn.addEventListener("click", () => this.setMode("list"));
    this.els.modeInteractiveBtn.addEventListener("click", () => this.setMode("interactive"));
    this.els.sendBtn.addEventListener("click", () => this.sendToChildren());
    this.els.clearLiveBtn.addEventListener("click", () => this.clearLiveQuiz());

    this.listenScoreboard();
  },

  setStatus(msg, kind) {
    this.els.ocrStatus.textContent = msg;
    this.els.ocrStatus.className = "status" + (kind ? " " + kind : "");
  },

  async handleGenerate() {
    const files = Array.from(this.els.photoInput.files || []);
    if (!files.length) {
      this.setStatus("Add at least one photo first.", "error");
      return;
    }

    this.els.generateBtn.disabled = true;
    this.uploadPhotos(files);

    try {
      const text = await extractTextFromImages(files, (msg) => this.setStatus(msg));
      if (!text || text.trim().length < 20) {
        this.setStatus("Couldn't read enough text from those photos — try clearer, well-lit photos.", "error");
        return;
      }

      this.questions = generateQuestions(text);
      if (!this.questions.length) {
        this.setStatus("Couldn't build questions from that text — try a page with fuller sentences.", "error");
        return;
      }

      this.setStatus(`Generated ${this.questions.length} questions.`, "success");
      this.els.questionsCard.classList.remove("hidden");
      this.renderQuestions();
    } catch (err) {
      console.error(err);
      this.setStatus("Something went wrong reading those photos. Try again.", "error");
    } finally {
      this.els.generateBtn.disabled = false;
    }
  },

  async uploadPhotos(files) {
    for (const file of files) {
      try {
        const path = `uploads/${Date.now()}_${file.name}`;
        await storage.ref(path).put(file);
      } catch (err) {
        console.warn("Photo upload failed (question generation still works offline):", err);
      }
    }
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
      area.innerHTML = '<p class="muted">No questions yet.</p>';
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
      this.els.sendStatus.textContent = "Generate questions first.";
      this.els.sendStatus.className = "status error";
      return;
    }
    try {
      await db.collection("quiz").doc("current").set({
        questions: this.questions,
        sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      this.els.sendStatus.textContent = "Sent! Students will see it now.";
      this.els.sendStatus.className = "status success";
    } catch (err) {
      console.error(err);
      this.els.sendStatus.textContent = "Could not send — check your Firebase setup.";
      this.els.sendStatus.className = "status error";
    }
  },

  async clearLiveQuiz() {
    try {
      await db.collection("quiz").doc("current").delete();
      this.els.sendStatus.textContent = "Live quiz stopped.";
      this.els.sendStatus.className = "status";
    } catch (err) {
      console.error(err);
    }
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
