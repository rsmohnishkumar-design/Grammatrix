// Shared rendering + helpers used by both the student flow and the
// teacher's interactive preview in the Hidden Room.

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Builds the same correct/wrong breakdown list used right after a fresh
// submit and when reopening a past attempt from "Test attended" — items
// is [{questionText, correctAnswer, yourAnswer}].
function renderResultBreakdown(container, items) {
  container.innerHTML = "";
  items.forEach((item, i) => {
    const isCorrect = item.yourAnswer === item.correctAnswer;
    const block = document.createElement("div");
    block.className = "result-item " + (isCorrect ? "correct" : "wrong");
    block.innerHTML = `
      <div class="ri-q">${i + 1}. ${escapeHtml(item.questionText)}</div>
      <div class="ri-line ${isCorrect ? "good" : "bad"}">Your answer: ${escapeHtml(item.yourAnswer)}</div>
      ${isCorrect ? "" : `<div class="ri-line good">Correct answer: ${escapeHtml(item.correctAnswer)}</div>`}
    `;
    container.appendChild(block);
  });
}

function subjectIcon(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("bio")) return "🧬";
  if (s.includes("chem")) return "🧪";
  if (s.includes("phys")) return "🔭";
  if (s.includes("math")) return "➗";
  if (s.includes("eng")) return "📖";
  if (s.includes("hist")) return "🏛️";
  if (s.includes("geo")) return "🌍";
  if (s.includes("comp") || s.includes("cs")) return "💻";
  if (s.includes("art")) return "🎨";
  return "📚";
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
  liveRooms: [],
  activeRoom: null,
  roomsUnsub: null,
  suspiciousCount: 0,
  attendedScores: [],

  els: {},

  init() {
    this.els = {
      studentHome: document.getElementById("studentHome"),
      availableList: document.getElementById("availableList"),
      noTestCard: document.getElementById("noTestCard"),
      attendedList: document.getElementById("attendedList"),

      quizCard: document.getElementById("studentQuizCard"),
      progress: document.getElementById("qProgress"),
      subjectTag: document.getElementById("qSubjectTag"),
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

      pastAttemptCard: document.getElementById("pastAttemptCard"),
      pastAttemptText: document.getElementById("pastAttemptText"),
      pastAttemptArea: document.getElementById("pastAttemptArea"),
      pastAttemptBackBtn: document.getElementById("pastAttemptBackBtn"),

      testModeUI: document.getElementById("testModeUI"),
      fullscreenNudge: document.getElementById("fullscreenNudge"),
      logoutBtn: document.getElementById("studentLogout"),
      leaveConfirmModal: document.getElementById("leaveConfirmModal"),
      leaveCancelBtn: document.getElementById("leaveCancelBtn"),
      leaveConfirmBtn: document.getElementById("leaveConfirmBtn"),
      resumeFullscreenBtn: document.getElementById("resumeFullscreenBtn"),
    };

    this.els.prevBtn.addEventListener("click", () => this.prevQuestion());
    this.els.nextBtn.addEventListener("click", () => this.nextQuestion());
    this.els.submitBtn.addEventListener("click", () => this.submitTest());
    this.els.checkedBtn.addEventListener("click", () => this.showHome());
    this.els.pastAttemptBackBtn.addEventListener("click", () => this.closePastAttempt());
    this.els.attendedList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-attended-index]");
      if (!btn) return;
      this.showPastAttempt(Number(btn.dataset.attendedIndex));
    });

    this.els.resumeFullscreenBtn.addEventListener("click", () => this.requestFullscreenSafe());
    this.els.leaveCancelBtn.addEventListener("click", () => this.cancelLeaveTest());
    this.els.leaveConfirmBtn.addEventListener("click", () => this.confirmLeaveTest());
    document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    ["contextmenu", "copy", "cut", "selectstart"].forEach((evt) => {
      document.addEventListener(evt, (e) => {
        if (this.inTestMode()) e.preventDefault();
      });
    });

    this.els.availableList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-room-id]");
      if (!btn) return;
      this.beginTest(btn.dataset.roomId);
    });

    // Covers a page reload with an already-saved session. A *fresh* login
    // re-subscribes again via routeTo() — see subscribeRooms() below for
    // why that re-subscribe is necessary, not just a courtesy refresh.
    this.subscribeRooms();
    this.showHome();
  },

  // Subscribing once at page load isn't enough: that subscription's very
  // first (and maybe only) callback can fire before anyone has logged in,
  // when tq_user is still empty — so it filters to zero rooms and then
  // never re-fires just because a variable changed elsewhere in the app.
  // routeTo() calls this again right after login so the filter runs with
  // the now-known grade/section, the same fix pattern used for the
  // "past scores missing after fresh login" bug.
  subscribeRooms() {
    if (this.roomsUnsub) this.roomsUnsub();
    this.roomsUnsub = db.collection("rooms").onSnapshot((snap) => {
      const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
      this.liveRooms = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => Array.isArray(r.questions) && r.questions.length)
        .filter((r) => user.role === "student" && String(r.grade) === String(user.grade) && String(r.section || "").toLowerCase() === String(user.section || "").toLowerCase());
      // Only auto-refresh the highlight while idle at home — never yank
      // someone out of a test they're actively taking, reviewing, or
      // just finished looking at.
      if (this.state === "home") this.showAvailable();
    });
  },

  showHome() {
    this.state = "home";
    this.exitTestMode();
    this.els.quizCard.classList.add("hidden");
    this.els.reviewCard.classList.add("hidden");
    this.els.resultCard.classList.add("hidden");
    this.els.pastAttemptCard.classList.add("hidden");
    this.els.resultCard.querySelectorAll(".confetti-piece").forEach((el) => el.remove());
    this.els.studentHome.classList.remove("hidden");
    this.showAvailable();
    this.loadAttended();
  },

  // ---- Best-effort test-mode deterrents ----
  // None of this can actually stop a screenshot or screen recording — no
  // website can. It locks fullscreen (and nags if the student leaves it),
  // discourages right-click/copy, and counts how many times the student
  // left the test so the teacher can see it next to their score.

  inTestMode() {
    return this.state === "answering" || this.state === "reviewing";
  },

  enterTestMode() {
    this.suspiciousCount = 0;
    this.els.testModeUI.classList.remove("hidden");
    this.els.quizCard.classList.add("test-locked");
    this.els.reviewCard.classList.add("test-locked");
    // The logout button becomes "Leave" during a test — clicking it opens
    // a confirmation instead of logging out immediately, so a student
    // can't walk away from a test without a clear warning first.
    this.els.logoutBtn.textContent = "Leave";
    this.requestFullscreenSafe();
  },

  exitTestMode() {
    this.els.testModeUI.classList.add("hidden");
    this.els.fullscreenNudge.classList.add("hidden");
    this.els.leaveConfirmModal.classList.add("hidden");
    this.els.quizCard.classList.remove("test-locked");
    this.els.reviewCard.classList.remove("test-locked");
    this.els.logoutBtn.textContent = "Log out";
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  },

  promptLeaveTest() {
    if (!this.inTestMode()) return;
    this.els.leaveConfirmModal.classList.remove("hidden");
  },

  cancelLeaveTest() {
    this.els.leaveConfirmModal.classList.add("hidden");
  },

  // Leaving mid-test still grades and saves whatever was answered so far
  // (unanswered questions count as wrong), tagged leftEarly so the
  // teacher can tell it apart from a normal completed submission.
  async confirmLeaveTest() {
    this.els.leaveConfirmModal.classList.add("hidden");

    let score = 0;
    this.questions.forEach((q, i) => {
      if (this.answers[i] === q.correctAnswer) score += 1;
    });
    this.score = score;

    const current = JSON.parse(localStorage.getItem("tq_user") || "{}");
    const room = this.activeRoom || {};
    try {
      await db.collection("scores").add({
        username: current.username || "Unknown",
        score,
        total: this.questions.length,
        grade: room.grade || current.grade || null,
        section: room.section || current.section || null,
        subject: room.subject || null,
        roomId: room.id || null,
        suspicious: this.suspiciousCount,
        leftEarly: true,
        answers: this.questions.map((q, i) => ({
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          yourAnswer: this.answers[i] || "Not answered",
        })),
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save score before leaving:", err);
    }

    // Leaving a test should land back on the student's own home tab
    // (Test attended etc.), not sign them out of the app entirely — they
    // shouldn't have to type their name/grade/section in again right
    // after just being warned their score was being saved.
    this.showHome();
  },

  requestFullscreenSafe() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    this.els.fullscreenNudge.classList.add("hidden");
  },

  handleFullscreenChange() {
    if (this.inTestMode() && !document.fullscreenElement) {
      this.suspiciousCount += 1;
      this.els.fullscreenNudge.classList.remove("hidden");
    } else {
      this.els.fullscreenNudge.classList.add("hidden");
    }
  },

  handleVisibilityChange() {
    if (this.inTestMode() && document.hidden) {
      this.suspiciousCount += 1;
    }
  },

  showAvailable() {
    if (this.liveRooms.length) {
      this.els.noTestCard.classList.add("hidden");
      this.els.availableList.innerHTML = this.liveRooms.map((r) => {
        const n = r.questions.length;
        return `
          <div class="card available-card">
            <div class="subject-icon">${subjectIcon(r.subject)}</div>
            <h2>${escapeHtml(r.subject)}</h2>
            <p>${n} question${n === 1 ? "" : "s"} waiting for you.</p>
            <div class="btn-row" style="justify-content:center">
              <button class="btn primary" data-room-id="${r.id}">Start Test</button>
            </div>
          </div>
        `;
      }).join("");
    } else {
      this.els.availableList.innerHTML = "";
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
        // Matching on username alone isn't enough — the same name can be
        // reused by a different student in a different grade/section (e.g.
        // several "Sam"s across the school), and without this check each
        // would see every other's test history. Grade + section must also
        // match the class this student is currently logged into.
        const mine = snap.docs.map((d) => d.data()).filter((r) =>
          r.username === username &&
          String(r.grade) === String(current.grade) &&
          String(r.section || "").toLowerCase() === String(current.section || "").toLowerCase()
        );
        this.attendedScores = mine.slice(0, 10);
        if (!this.attendedScores.length) {
          area.innerHTML = '<p class="muted">You haven\'t attended any tests yet.</p>';
          return;
        }
        area.innerHTML = this.attendedScores.map((r, i) => {
          const date = r.ts && r.ts.toDate ? r.ts.toDate().toLocaleString() : "Just now";
          const subject = r.subject ? `<span class="subject-tag">${escapeHtml(r.subject)}</span>` : "";
          return `<button class="attended-item" data-attended-index="${i}">
            <span class="ai-left"><span class="ai-date">${escapeHtml(date)}</span> ${subject}</span>
            <span class="ai-score">${r.score}/${r.total} <span class="ai-chevron">›</span></span>
          </button>`;
        }).join("");
      })
      .catch((err) => {
        console.warn("Could not load attended tests:", err);
        area.innerHTML = '<p class="muted">Could not load your test history.</p>';
      });
  },

  showPastAttempt(index) {
    const record = this.attendedScores[index];
    if (!record) return;
    this.els.studentHome.classList.add("hidden");
    this.els.pastAttemptCard.classList.remove("hidden");

    const date = record.ts && record.ts.toDate ? record.ts.toDate().toLocaleString() : "Just now";
    const subjectBit = record.subject ? ` • ${escapeHtml(record.subject)}` : "";
    this.els.pastAttemptText.innerHTML = `You scored <strong>${record.score} out of ${record.total}</strong> — ${escapeHtml(date)}${subjectBit}`;

    if (Array.isArray(record.answers) && record.answers.length) {
      renderResultBreakdown(this.els.pastAttemptArea, record.answers);
    } else {
      this.els.pastAttemptArea.innerHTML = '<p class="muted">A question-by-question breakdown isn\'t available for this older attempt.</p>';
    }
  },

  closePastAttempt() {
    this.els.pastAttemptCard.classList.add("hidden");
    this.showHome();
  },

  beginTest(roomId) {
    const room = this.liveRooms.find((r) => r.id === roomId);
    if (!room) return;
    this.activeRoom = room;
    this.questions = room.questions;
    this.answers = new Array(this.questions.length).fill(null);
    this.index = 0;
    this.fromReview = false;
    this.state = "answering";
    this.els.studentHome.classList.add("hidden");
    this.els.quizCard.classList.remove("hidden");
    this.els.subjectTag.textContent = room.subject;
    this.enterTestMode();
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
    const room = this.activeRoom || {};
    try {
      await db.collection("scores").add({
        username: current.username || "Unknown",
        score,
        total: this.questions.length,
        grade: room.grade || current.grade || null,
        section: room.section || current.section || null,
        subject: room.subject || null,
        roomId: room.id || null,
        suspicious: this.suspiciousCount,
        // Snapshotted here rather than re-read from the room later: the
        // teacher can reset/stop/change the room's questions afterward,
        // so this is the only reliable record of what was actually asked
        // and answered for "Test attended" to show a breakdown from.
        answers: this.questions.map((q, i) => ({
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          yourAnswer: this.answers[i],
        })),
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save score:", err);
    }

    this.els.submitBtn.disabled = false;
    this.state = "results";
    this.exitTestMode();
    this.showResults();
  },

  showResults() {
    this.els.reviewCard.classList.add("hidden");
    this.els.resultCard.classList.remove("hidden");
    this.els.resultText.textContent = `You scored ${this.score} out of ${this.questions.length}.`;

    renderResultBreakdown(this.els.resultsArea, this.questions.map((q, i) => ({
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      yourAnswer: this.answers[i],
    })));

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
