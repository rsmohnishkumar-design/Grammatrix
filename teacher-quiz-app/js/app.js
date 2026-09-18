const TEACHER_CODE = "4456";

const views = {
  login: document.getElementById("loginView"),
  student: document.getElementById("studentView"),
  hiddenRoom: document.getElementById("hiddenRoomView"),
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
}

async function recordLogin(username, role) {
  try {
    await db.collection("logins").add({
      username,
      role,
      ts: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("Could not record login:", err);
  }
}

function routeTo(user) {
  if (user.role === "teacher") {
    showView("hiddenRoom");
  } else {
    document.getElementById("studentGreeting").textContent = `Hi, ${user.username}`;
    showView("student");
  }
}

function logout() {
  localStorage.removeItem("tq_user");
  showView("login");
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = document.getElementById("usernameInput").value.trim();
  const statusEl = document.getElementById("loginStatus");
  if (!raw) return;

  const role = raw === TEACHER_CODE ? "teacher" : "student";
  const username = role === "teacher" ? "Teacher" : raw;
  const user = { username, role };

  localStorage.setItem("tq_user", JSON.stringify(user));
  statusEl.textContent = "";
  recordLogin(username, role);
  routeTo(user);
});

document.getElementById("studentLogout").addEventListener("click", logout);
document.getElementById("teacherLogout").addEventListener("click", logout);

StudentQuiz.init();
HiddenRoom.init();

const existing = JSON.parse(localStorage.getItem("tq_user") || "null");
if (existing) {
  if (existing.role === "student") {
    document.getElementById("studentGreeting").textContent = `Hi, ${existing.username}`;
  }
  routeTo(existing);
} else {
  showView("login");
}
