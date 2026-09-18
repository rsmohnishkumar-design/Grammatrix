// Shared "choose the correct option" rendering, used by both the student
// quiz and the teacher's interactive preview in the Hidden Room.

function renderOptions(container, question, onSelect) {
  container.innerHTML = "";
  question.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option" + (opt === "I don't know" ? " idk" : "");
    btn.textContent = opt;
    btn.addEventListener("click", () => onSelect(opt, btn, container));
    container.appendChild(btn);
  });
}

function lockOptions(container, question, chosenBtn) {
  const buttons = Array.from(container.querySelectorAll(".option"));
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === question.correctAnswer) btn.classList.add("correct");
    else if (btn === chosenBtn) btn.classList.add("wrong");
  });
}

// ---- Student-facing live quiz ----

const StudentQuiz = {
  questions: [],
  index: 0,
  score: 0,
  answered: false,

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
      this.els.resultCard.classList.add("hidden");
      this.els.waiting.classList.remove("hidden");
    });

    db.collection("quiz").doc("current").onSnapshot((doc) => {
      if (doc.exists && Array.isArray(doc.data().questions) && doc.data().questions.length) {
        this.start(doc.data().questions);
      } else {
        this.showWaiting();
      }
    });
  },

  showWaiting() {
    this.els.waiting.classList.remove("hidden");
    this.els.quizCard.classList.add("hidden");
    this.els.resultCard.classList.add("hidden");
  },

  start(questions) {
    this.questions = questions;
    this.index = 0;
    this.score = 0;
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
    this.els.quizCard.classList.add("hidden");
    this.els.resultCard.classList.remove("hidden");
    this.els.resultText.textContent = `You scored ${this.score} out of ${this.questions.length}.`;
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
