// Shared rendering + helpers used by both the student flow and the
// teacher's interactive preview in the Hidden Room.

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Teacher's interactive preview: clicking an option instantly reveals
// correct/wrong, purely so the teacher can see what the test will feel
// like. Students never get this — see renderSelectableOptions below.
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

// Student-facing: picking an option just marks it selected — no reveal.
// Correctness only ever shows after the whole test is submitted. Every
// option gets a radio-style indicator on the right so the chosen answer
// is unmistakable, not just a faint border tint.
function renderSelectableOptions(container, question, selectedValue, onSelect) {
  container.innerHTML = "";
  const mainOptions = question.options.filter((o) => o !== "I don't know");

  const addRadio = (btn) => {
    const radio = document.createElement("span");
    radio.className = "option-radio";
    btn.appendChild(radio);
  };

  mainOptions.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option" + (opt === selectedValue ? " selected" : "");
    btn.dataset.value = opt;
    const badge = document.createElement("span");
    badge.className = "option-badge";
    badge.textContent = LETTERS[i] || String(i + 1);
    btn.appendChild(badge);
    btn.appendChild(document.createTextNode(opt));
    addRadio(btn);
    btn.addEventListener("click", () => onSelect(opt));
    container.appendChild(btn);
  });

  const divider = document.createElement("div");
  divider.className = "idk-divider";
  divider.textContent = "or";
  container.appendChild(divider);

  const idkBtn = document.createElement("button");
  idkBtn.className = "option idk" + (selectedValue === "I don't know" ? " selected" : "");
  idkBtn.dataset.value = "I don't know";
  idkBtn.appendChild(document.createTextNode("🤷 I don't know"));
  addRadio(idkBtn);
  idkBtn.addEventListener("click", () => onSelect("I don't know"));
  container.appendChild(idkBtn);
}

// ---- Student-facing test flow ----
// States: "home" -> "answering" -> "reviewing" -> "results" -> "home" (Checked)

const StudentQuiz = {
  questions: [],
  answers: [],
  index: 0,
  score: 0,
  state: "home",
  fromReview: false,
  pendingQuestions: null,
  pendingQuizId: null,

  els: {},

  init() {
    this.els = {
      studentHome: document.getElementById("studentHome"),
      availableCard: document.getElementById("availableCard"),
      availableCount: document.getElementById("availableCount"),
      noTestCard: document.getElementById("noTestCard"),
      startTestBtn: document.getElementById("startTestBtn"),
      attendedList: document.getElementById("attendedList"),

      quizCard: document.getElementById("studentQuizCard"),
      progress: document.getElementById("qProgress"),
      text: document.getElementById("qText"),
      options: document.getElementById("qOptions"),
      prevBtn: document.getElementById("qPrevBtn"),
      nextBtn: document.getElementById("qNextBtn"),

      reviewCard: document.getElementById("studentReviewCard"),
      reviewArea: document.getElementById("reviewArea"),
      submitBtn: document.getElementById("submitTestBtn"),
      submitStatus: document.getElementById("submitStatus"),

      resultCard: document.getElementById("studentResultCard"),
      resultText: document.getElementById("resultText"),
      resultsArea: document.getElementById("resultsArea"),
      checkedBtn: document.getElementById("checkedBtn"),
    };

    this.els.startTestBtn.addEventListener("click", () => this.beginTest());
    this.els.prevBtn.addEventListener("click", () => this.prevQuestion());
    this.els.nextBtn.addEventListener("click", () => this.nextQuestion());
    this.els.submitBtn.addEventListener("click", () => this.submitTest());
    this.els.checkedBtn.addEventListener("click", () => this.showHome());

    db.collection("quiz").doc("current").onSnapshot((doc) => {
      const hasTest = doc.exists && Array.isArray(doc.data().questions) && doc.data().questions.length;
      if (hasTest) {
        const data = doc.data();
        this.pendingQuestions = data.questions;
        this.pendingQuizId = data.id || JSON.stringify(data.questions);
      } else {
        this.pendingQuestions = null;
        this.pendingQuizId = null;
      }
      // Only auto-refresh the highlight while idle at home — never yank
      // someone out of a test they're actively taking, reviewing, or
      // just finished looking at.
      if (this.state === "home") this.showAvailable();
    });

    this.showHome();
  },

  showHome() {
    this.state = "home";
    this.els.quizCard.classList.add("hidden");
    this.els.reviewCard.classList.add("hidden");
    this.els.resultCard.classList.add("hidden");
    this.els.resultCard.querySelectorAll(".confetti-piece").forEach((el) => el.remove());
    this.els.studentHome.classList.remove("hidden");
    this.showAvailable();
    this.loadAttended();
  },

  showAvailable() {
    if (this.pendingQuestions) {
      this.els.availableCard.classList.remove("hidden");
      this.els.noTestCard.classList.add("hidden");
      const n = this.pendingQuestions.length;
      this.els.availableCount.textContent = `${n} question${n === 1 ? "" : "s"} waiting for you.`;
    } else {
      this.els.availableCard.classList.add("hidden");
      this.els.noTestCard.classList.remove("hidden");
    }
  },

  loadAttended() {
    const current = JSON.parse(localStorage.getItem("tq_user") || "{}");
    const username = current.username;
    const area = this.els.attendedList;
    if (!username) return;

    db.collection("scores").orderBy("ts", "desc").limit(100).get()
      .then((snap) => {
        const mine = snap.docs.map((d) => d.data()).filter((r) => r.username === username);
        if (!mine.length) {
          area.innerHTML = '<p class="muted">You haven\'t attended any tests yet.</p>';
          return;
        }
        area.innerHTML = mine.slice(0, 10).map((r) => {
          const date = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString() : "Just now";
          return `<div class="attended-item"><span class="ai-date">${escapeHtml(date)}</span><span class="ai-score">${r.score}/${r.total}</span></div>`;
        }).join("");
      })
      .catch((err) => {
        console.warn("Could not load attended tests:", err);
        area.innerHTML = '<p class="muted">Could not load your test history.</p>';
      });
  },

  beginTest() {
    if (!this.pendingQuestions) return;
    this.questions = this.pendingQuestions;
    this.answers = new Array(this.questions.length).fill(null);
    this.index = 0;
    this.fromReview = false;
    this.state = "answering";
    this.els.studentHome.classList.add("hidden");
    this.els.quizCard.classList.remove("hidden");
    this.renderCurrent();
  },

  renderCurrent() {
    const q = this.questions[this.index];
    const isLast = this.index === this.questions.length - 1;

    this.els.progress.textContent = `Question ${this.index + 1} of ${this.questions.length}`;
    this.els.text.textContent = q.questionText;
    this.els.prevBtn.classList.toggle("hidden", this.fromReview || this.index === 0);
    this.els.nextBtn.textContent = this.fromReview ? "Back to review" : (isLast ? "Review & Submit" : "Next");

    renderSelectableOptions(this.els.options, q, this.answers[this.index], (opt) => {
      this.answers[this.index] = opt;
      // Toggle the selected class on the existing buttons rather than
      // re-rendering the whole list — rebuilding the DOM here would
      // re-trigger the entrance animation on every click, making the
      // options visibly flicker right when the student needs to see
      // their pick land.
      Array.from(this.els.options.querySelectorAll(".option")).forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.value === opt);
      });
    });
    this.replayEnterAnimation();
  },

  replayEnterAnimation() {
    this.els.quizCard.classList.remove("question-enter");
    void this.els.quizCard.offsetWidth; // force reflow so the animation restarts
    this.els.quizCard.classList.add("question-enter");
  },

  prevQuestion() {
    if (this.index > 0) {
      this.index -= 1;
      this.renderCurrent();
    }
  },

  nextQuestion() {
    if (this.fromReview) {
      this.showReview();
      return;
    }
    if (this.index < this.questions.length - 1) {
      this.index += 1;
      this.renderCurrent();
    } else {
      this.showReview();
    }
  },

  showReview() {
    this.state = "reviewing";
    this.fromReview = false;
    this.els.quizCard.classList.add("hidden");
    this.els.reviewCard.classList.remove("hidden");
    this.els.submitStatus.textContent = "";

    const area = this.els.reviewArea;
    area.innerHTML = "";
    this.questions.forEach((q, i) => {
      const ans = this.answers[i];
      const block = document.createElement("div");
      block.className = "review-item" + (ans ? "" : " unanswered");
      block.innerHTML = `
        <div class="ri-q">${i + 1}. ${escapeHtml(q.questionText)}</div>
        <div class="ri-a">${ans ? `Your answer: <strong>${escapeHtml(ans)}</strong>` : "⚠️ Not answered yet"}</div>
      `;
      const changeBtn = document.createElement("button");
      changeBtn.className = "ri-change";
      changeBtn.textContent = ans ? "Change answer" : "Answer now";
      changeBtn.addEventListener("click", () => {
        this.index = i;
        this.fromReview = true;
        this.state = "answering";
        this.els.reviewCard.classList.add("hidden");
        this.els.quizCard.classList.remove("hidden");
        this.renderCurrent();
      });
      block.appendChild(changeBtn);
      area.appendChild(block);
    });
  },

  async submitTest() {
    const unanswered = this.answers.filter((a) => !a).length;
    if (unanswered > 0) {
      this.els.submitStatus.textContent = `You still have ${unanswered} question${unanswered === 1 ? "" : "s"} unanswered.`;
      this.els.submitStatus.className = "status error";
      return;
    }

    this.els.submitBtn.disabled = true;
    let score = 0;
    this.questions.forEach((q, i) => {
      if (this.answers[i] === q.correctAnswer) score += 1;
    });
    this.score = score;

    const current = JSON.parse(localStorage.getItem("tq_user") || "{}");
    try {
      await db.collection("scores").add({
        username: current.username || "Unknown",
        score,
        total: this.questions.length,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save score:", err);
    }

    this.els.submitBtn.disabled = false;
    this.state = "results";
    this.showResults();
  },

  showResults() {
    this.els.reviewCard.classList.add("hidden");
    this.els.resultCard.classList.remove("hidden");
    this.els.resultText.textContent = `You scored ${this.score} out of ${this.questions.length}.`;

    const area = this.els.resultsArea;
    area.innerHTML = "";
    this.questions.forEach((q, i) => {
      const ans = this.answers[i];
      const isCorrect = ans === q.correctAnswer;
      const block = document.createElement("div");
      block.className = "result-item " + (isCorrect ? "correct" : "wrong");
      block.innerHTML = `
        <div class="ri-q">${i + 1}. ${escapeHtml(q.questionText)}</div>
        <div class="ri-line ${isCorrect ? "good" : "bad"}">Your answer: ${escapeHtml(ans)}</div>
        ${isCorrect ? "" : `<div class="ri-line good">Correct answer: ${escapeHtml(q.correctAnswer)}</div>`}
      `;
      area.appendChild(block);
    });

    this.spawnConfetti();
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
};
