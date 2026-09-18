// Shared "choose the correct option" rendering, used by both the student
// quiz and the teacher's interactive preview in the Hidden Room.

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function renderOptions(container, question, onSelect) {
  container.innerHTML = "";
  const mainOptions = question.options.filter((o) => o !== "I don't know");

  mainOptions.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.dataset.value = opt;
    const badge = document.createElement("span");
    badge.className = "option-badge";
    badge.textContent = LETTERS[i] || String(i + 1);
    btn.appendChild(badge);
    btn.appendChild(document.createTextNode(opt));
    btn.addEventListener("click", () => onSelect(opt, btn, container));
    container.appendChild(btn);
  });

  const divider = document.createElement("div");
  divider.className = "idk-divider";
  divider.textContent = "or";
  container.appendChild(divider);

  const idkBtn = document.createElement("button");
  idkBtn.className = "option idk";
  idkBtn.dataset.value = "I don't know";
  idkBtn.textContent = "🤷 I don't know";
  idkBtn.addEventListener("click", () => onSelect("I don't know", idkBtn, container));
  container.appendChild(idkBtn);
}

function lockOptions(container, question, chosenBtn) {
  const buttons = Array.from(container.querySelectorAll(".option"));
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.value === question.correctAnswer) btn.classList.add("correct");
    else if (btn === chosenBtn) btn.classList.add("wrong");
    else btn.classList.add("dim");
  });
}

// ---- Student-facing live quiz ----

const StudentQuiz = {
  questions: [],
  index: 0,
  score: 0,
  answered: false,
  state: "waiting", // "waiting" | "answering" | "finished"
  lastQuizId: null,

  els: {},

  init() {
    this.els = {
      waiting: document.getElementById("studentWaiting"),
      quizCard: document.getElementById("studentQuizCard"),
      resultCard: document.getElementById("studentResultCard"),
      progress: document.getElementById("qProgress"),
      score: document.getElementById("qScore"),
      text: document.getElementById("qText"),
      options: document.getElementById("qOptions"),
      nextBtn: document.getElementById("qNextBtn"),
      resultText: document.getElementById("resultText"),
      okBtn: document.getElementById("resultOkBtn"),
    };

    this.els.nextBtn.addEventListener("click", () => this.next());
    this.els.okBtn.addEventListener("click", () => {
      this.state = "waiting";
      this.showWaiting();
    });

    db.collection("quiz").doc("current").onSnapshot((doc) => {
      const hasQuiz = doc.exists && Array.isArray(doc.data().questions) && doc.data().questions.length;

      if (hasQuiz) {
        const data = doc.data();
        const quizId = data.id || JSON.stringify(data.questions);
        // A genuinely new quiz always takes over, even mid-answer.
        // The same quiz re-notifying (e.g. a Firestore reconnect) should
        // never interrupt a question in progress or a just-finished result.
        if (quizId !== this.lastQuizId) {
          this.lastQuizId = quizId;
          this.start(data.questions);
        }
      } else if (this.state !== "finished") {
        // The teacher stopped the quiz. Don't yank someone off their
        // results screen — only snap back to waiting if they weren't
        // already looking at a finished result.
        this.lastQuizId = null;
        this.state = "waiting";
        this.showWaiting();
      } else {
        this.lastQuizId = null;
      }
    });
  },

  showWaiting() {
    this.els.waiting.classList.remove("hidden");
    this.els.quizCard.classList.add("hidden");
    this.els.resultCard.classList.add("hidden");
    this.els.resultCard.querySelectorAll(".confetti-piece").forEach((el) => el.remove());
  },

  start(questions) {
    this.questions = questions;
    this.index = 0;
    this.score = 0;
    this.state = "answering";
    this.els.waiting.classList.add("hidden");
    this.els.resultCard.classList.add("hidden");
    this.els.quizCard.classList.remove("hidden");
    this.renderCurrent();
  },

  renderCurrent() {
    this.answered = false;
    const q = this.questions[this.index];
    this.els.progress.textContent = `Question ${this.index + 1} of ${this.questions.length}`;
    this.els.score.textContent = `Score: ${this.score}`;
    this.els.text.textContent = q.questionText;
    this.els.nextBtn.classList.add("hidden");
    renderOptions(this.els.options, q, (opt, btn, container) => {
      if (this.answered) return;
      this.answered = true;
      lockOptions(container, q, btn);
      if (opt === q.correctAnswer) this.score += 1;
      this.els.score.textContent = `Score: ${this.score}`;
      this.els.nextBtn.classList.remove("hidden");
    });
    this.replayEnterAnimation();
  },

  replayEnterAnimation() {
    this.els.quizCard.classList.remove("question-enter");
    void this.els.quizCard.offsetWidth; // force reflow so the animation restarts
    this.els.quizCard.classList.add("question-enter");
  },

  spawnConfetti() {
    const emojis = ["🎉", "✨", "⭐", "🎊"];
    for (let i = 0; i < 14; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${(Math.random() * 0.3).toFixed(2)}s`;
      piece.addEventListener("animationend", () => piece.remove());
      this.els.resultCard.appendChild(piece);
    }
  },

  next() {
    if (this.index < this.questions.length - 1) {
      this.index += 1;
      this.renderCurrent();
    } else {
      this.finish();
    }
  },

  async finish() {
    const current = JSON.parse(localStorage.getItem("tq_user") || "{}");
    this.state = "finished";
    this.els.quizCard.classList.add("hidden");
    this.els.resultCard.classList.remove("hidden");
    this.els.resultText.textContent = `You scored ${this.score} out of ${this.questions.length}.`;
    this.spawnConfetti();
    try {
      await db.collection("scores").add({
        username: current.username || "Unknown",
        score: this.score,
        total: this.questions.length,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save score", err);
    }
  },
};
