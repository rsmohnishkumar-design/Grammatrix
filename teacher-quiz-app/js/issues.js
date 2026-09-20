// Shared "Report an issue" flow, opened from the ⋮ menu in the student
// and teacher navbars. One modal, reused by every view — reports are
// read in the admin room (login code 2708).

const IssueReporter = {
  els: {},

  init() {
    this.els = {
      modal: document.getElementById("reportIssueModal"),
      text: document.getElementById("reportIssueText"),
      status: document.getElementById("reportIssueStatus"),
      cancelBtn: document.getElementById("reportIssueCancelBtn"),
      submitBtn: document.getElementById("reportIssueSubmitBtn"),
    };

    this.els.cancelBtn.addEventListener("click", () => this.close());
    this.els.submitBtn.addEventListener("click", () => this.submit());

    // Every ⋮ button on the page wires up the same way: toggle its own
    // dropdown, closing any other one that's open.
    document.querySelectorAll("[data-kebab-btn]").forEach((btn) => {
      const dropdown = document.getElementById(btn.dataset.kebabBtn);
      if (!dropdown) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = !dropdown.classList.contains("hidden");
        document.querySelectorAll(".kebab-dropdown").forEach((d) => d.classList.add("hidden"));
        dropdown.classList.toggle("hidden", wasOpen);
      });
    });

    document.querySelectorAll("[data-report-issue-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".kebab-dropdown").forEach((d) => d.classList.add("hidden"));
        this.open();
      });
    });

    // Click-away closes any open dropdown.
    document.addEventListener("click", () => {
      document.querySelectorAll(".kebab-dropdown").forEach((d) => d.classList.add("hidden"));
    });
  },

  open() {
    this.els.text.value = "";
    this.els.status.textContent = "";
    this.els.status.className = "status";
    this.els.modal.classList.remove("hidden");
    this.els.text.focus();
  },

  close() {
    this.els.modal.classList.add("hidden");
  },

  async submit() {
    const message = this.els.text.value.trim();
    if (!message) {
      this.els.status.textContent = "Please describe the issue first.";
      this.els.status.className = "status error";
      return;
    }

    const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
    this.els.submitBtn.disabled = true;
    try {
      await db.collection("issues").add({
        message,
        username: user.username || "Unknown",
        role: user.role || "unknown",
        grade: user.grade || null,
        section: user.section || null,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
      this.els.status.textContent = "Thanks — sent to the admin.";
      this.els.status.className = "status success";
      setTimeout(() => this.close(), 900);
    } catch (err) {
      console.error(err);
      // Show the real reason on-screen, not just a generic message — on a
      // phone with the app installed there's usually no easy way to open
      // DevTools and see console.error output above.
      const reason = (err && (err.code || err.message)) || "unknown error";
      this.els.status.textContent = `Could not send (${reason}). Check your connection and try again.`;
      this.els.status.className = "status error";
    } finally {
      this.els.submitBtn.disabled = false;
    }
  },
};
