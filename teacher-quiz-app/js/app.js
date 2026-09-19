const TEACHER_CODE = "4456";

const views = {
  login: document.getElementById("loginView"),
  student: document.getElementById("studentView"),
  hiddenRoom: document.getElementById("hiddenRoomView"),
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  document.getElementById("appBackdrop").classList.toggle("hidden", name !== "login");
}

async function recordLogin(username, role, grade, section) {
  try {
    const payload = {
      username,
      role,
      ts: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (grade) payload.grade = grade;
    if (section) payload.section = section;
    await db.collection("logins").add(payload);
  } catch (err) {
    console.warn("Could not record login:", err);
  }
}

function routeTo(user) {
  if (user.role === "teacher") {
    showView("hiddenRoom");
  } else {
    document.getElementById("studentGreeting").textContent = `Hi, ${user.username}`;
    document.getElementById("studentSubtitle").textContent = `Grade ${user.grade} • Section ${user.section}`;
    showView("student");
    // StudentQuiz.init() ran at page load, before any username was known,
    // so its rooms subscription and first showHome() couldn't filter or
    // load this user's data yet — refresh both now that we know who's
    // logged in.
    StudentQuiz.subscribeRooms();
    StudentQuiz.showHome();
  }
}

function logout() {
  localStorage.removeItem("tq_user");
  showView("login");
}

const usernameInput = document.getElementById("usernameInput");
const studentFieldsWrap = document.getElementById("studentFieldsWrap");
const gradeSelect = document.getElementById("gradeSelect");
const sectionInput = document.getElementById("sectionInput");

function syncStudentFieldsVisibility() {
  const isTeacherCode = usernameInput.value.trim() === TEACHER_CODE;
  studentFieldsWrap.classList.toggle("hidden", isTeacherCode);
}
usernameInput.addEventListener("input", syncStudentFieldsVisibility);
syncStudentFieldsVisibility();

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = usernameInput.value.trim();
  const statusEl = document.getElementById("loginStatus");
  if (!raw) return;

  const role = raw === TEACHER_CODE ? "teacher" : "student";
  let user;

  if (role === "teacher") {
    user = { username: "Teacher", role };
  } else {
    const grade = gradeSelect.value;
    const section = sectionInput.value.trim();
    if (!grade || !section) {
      statusEl.textContent = "Please choose your grade and enter your section.";
      statusEl.className = "status error";
      return;
    }
    user = { username: raw, role, grade, section };
  }

  localStorage.setItem("tq_user", JSON.stringify(user));
  statusEl.textContent = "";
  recordLogin(user.username, user.role, user.grade, user.section);
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
    document.getElementById("studentSubtitle").textContent = `Grade ${existing.grade} • Section ${existing.section}`;
  }
  routeTo(existing);
} else {
  showView("login");
}
