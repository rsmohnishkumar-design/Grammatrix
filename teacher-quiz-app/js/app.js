const TEACHER_CODE = "4456";
const ADMIN_CODE = "2708";

const views = {
  login: document.getElementById("loginView"),
  student: document.getElementById("studentView"),
  hiddenRoom: document.getElementById("hiddenRoomView"),
  admin: document.getElementById("adminView"),
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

// Two different students can end up in the same class with the same
// first name (common across a whole school, not just one section) — if
// both logged in as plain "Sam" in Grade 7 Section A, their test history
// would merge. This device is remembered as already "owning" a name in a
// given class (so the same student isn't blocked logging back in on their
// own phone), and any other device trying the same name in that exact
// class gets turned away instead of silently colliding.
function claimKey(grade, section) {
  return `tq_claim_g${grade}_s${String(section).toLowerCase()}`;
}

async function isUsernameTakenInClass(username, grade, section) {
  const key = claimKey(grade, section);
  const claimedHere = (localStorage.getItem(key) || "").toLowerCase();
  if (claimedHere === username.toLowerCase()) return false;

  try {
    const snap = await db.collection("logins").orderBy("ts", "desc").limit(500).get();
    const nameLower = username.toLowerCase();
    return snap.docs.some((d) => {
      const r = d.data();
      return r.role === "student" &&
        String(r.username || "").trim().toLowerCase() === nameLower &&
        String(r.grade) === String(grade) &&
        String(r.section || "").toLowerCase() === String(section).toLowerCase();
    });
  } catch (err) {
    console.warn("Could not check for a duplicate username:", err);
    return false; // fail open — a failed check shouldn't block a real login
  }
}

function routeTo(user) {
  if (user.role === "admin") {
    showView("admin");
    Admin.start();
  } else if (user.role === "teacher") {
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
  // A student can reach the logout button mid-test (it's in the navbar) —
  // make sure fullscreen/banner don't stay stuck over the login screen
  // afterward.
  StudentQuiz.state = "home";
  StudentQuiz.exitTestMode();
  Admin.stop();
  localStorage.removeItem("tq_user");
  showView("login");
}

const usernameInput = document.getElementById("usernameInput");
const studentFieldsWrap = document.getElementById("studentFieldsWrap");
const gradeSelect = document.getElementById("gradeSelect");
const sectionInput = document.getElementById("sectionInput");

function syncStudentFieldsVisibility() {
  const raw = usernameInput.value.trim();
  const isSpecialCode = raw === TEACHER_CODE || raw === ADMIN_CODE;
  studentFieldsWrap.classList.toggle("hidden", isSpecialCode);
}
usernameInput.addEventListener("input", syncStudentFieldsVisibility);
syncStudentFieldsVisibility();

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = usernameInput.value.trim();
  const statusEl = document.getElementById("loginStatus");
  const submitBtn = e.target.querySelector(".login-button");
  if (!raw) return;

  const role = raw === TEACHER_CODE ? "teacher" : raw === ADMIN_CODE ? "admin" : "student";
  let user;

  if (role === "teacher") {
    user = { username: "Teacher", role };
  } else if (role === "admin") {
    user = { username: "Admin", role };
  } else {
    const grade = gradeSelect.value;
    const section = sectionInput.value.trim();
    if (!grade || !section) {
      statusEl.textContent = "Please choose your grade and enter your section.";
      statusEl.className = "status error";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Checking your name…";
    statusEl.className = "status";
    const taken = await isUsernameTakenInClass(raw, grade, section);
    submitBtn.disabled = false;
    if (taken) {
      statusEl.textContent = `"${raw}" is already taken in Grade ${grade} Section ${section.toUpperCase()} — please add your class after your name, e.g. "${raw} ${section.toUpperCase()}2".`;
      statusEl.className = "status error";
      return;
    }

    user = { username: raw, role, grade, section };
    try {
      localStorage.setItem(claimKey(grade, section), raw);
    } catch (err) { /* ignore */ }
  }

  localStorage.setItem("tq_user", JSON.stringify(user));
  statusEl.textContent = "";
  recordLogin(user.username, user.role, user.grade, user.section);
  routeTo(user);
});

document.getElementById("studentLogout").addEventListener("click", logout);
document.getElementById("teacherLogout").addEventListener("click", logout);
document.getElementById("adminLogout").addEventListener("click", logout);

StudentQuiz.init();
HiddenRoom.init();
Admin.init();

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
