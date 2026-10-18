(() => {
  "use strict";

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const STORAGE = {
    tasks: "lour-task-manager-tasks-v1",
    subjects: "lour-task-manager-subjects-v1",
    streak: "lour-task-manager-streak-v1",
    name: "lour-task-manager-user-name-v1"
  };

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const save = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  let tasks = read(STORAGE.tasks, []);
  let subjects = read(STORAGE.subjects, []);
  let streak = read(STORAGE.streak, { count: 0, lastDate: null });
  let userName = read(STORAGE.name, "");
  let taskFilter = "all";
  let toastTimer;

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const dateLabel = iso => {
    if (!iso) return "No date";

    const d = new Date(`${iso}T12:00:00`);

    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
  };

  const esc = value =>
    String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () => node.classList.remove("show"),
      2200
    );
  }

  // NAME SETUP
  // Inline styles ensure the setup works without changing styles.css.
  const setup = $("#name-setup");
  const setupCard = $(".name-setup-card");
  const nameForm = $("#name-form");
  const nameInput = $("#user-name");
  const confirmation = $("#name-confirmation");
  const confirmationText = $("#name-confirmation-text");

  Object.assign(setup.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    background: "rgba(15, 15, 50, 0.78)",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    overflowY: "auto"
  });

  Object.assign(setupCard.style, {
    width: "100%",
    maxWidth: "420px",
    margin: "auto",
    padding: "24px",
    borderRadius: "20px",
    background: "var(--card, #ffffff)",
    color: "var(--text, #191970)",
    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.25)"
  });

  function showNameSetup() {
    if (userName && userName.trim()) {
      setup.style.display = "none";
      setup.hidden = true;
      updatePageTitle();
      return;
    }

    setup.hidden = false;
    setup.style.display = "flex";
    nameForm.hidden = false;
    confirmation.hidden = true;
    nameInput.value = "";
    nameInput.focus();
  }

  function updatePageTitle() {
    const currentScreen = $(".screen.active");
    const id = currentScreen ? currentScreen.id : "homescreen";
    const titles = {
      homescreen: `Hello, ${userName || "there"}!`,
      tasks: "My tasks",
      gwacalc: "GWA Calculator",
      streak: "Daily streak",
      tree: "Grow your tree",
      games: "Games~"
    };

    $("#page-title").textContent = titles[id] || "Task Manager";
  }

  nameForm.addEventListener("submit", event => {
    event.preventDefault();

    const enteredName = nameInput.value.trim();

    if (!enteredName) {
      nameInput.focus();
      return;
    }

    confirmationText.textContent = `I'll call you ${enteredName}.`;
    nameForm.hidden = true;
    confirmation.hidden = false;
  });

  $("#confirm-yes").addEventListener("click", () => {
    const confirmedName = nameInput.value.trim();

    if (!confirmedName) {
      confirmation.hidden = true;
      nameForm.hidden = false;
      nameInput.focus();
      return;
    }

    userName = confirmedName;
    save(STORAGE.name, userName);

    setup.style.display = "none";
    setup.hidden = true;

    updatePageTitle();
    toast(`Welcome, ${userName}!`);
  });

  $("#confirm-no").addEventListener("click", () => {
    confirmation.hidden = true;
    nameForm.hidden = false;
    nameInput.focus();
    nameInput.select();
  });

  // NAVIGATION
  function goTo(id) {
    if (!document.getElementById(id)) return;

    $$(".screen").forEach(screen => {
      screen.classList.toggle("active", screen.id === id);
    });

    $$(".nav-button").forEach(button => {
      button.classList.toggle("active", button.dataset.go === id);
    });

    updatePageTitle();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (id === "tasks") renderTasks();
  }

  $$("[data-go]").forEach(button => {
    button.addEventListener("click", () => goTo(button.dataset.go));
  });

  $("#today-label").textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );

  // HOME
  function renderHome() {
    const done = tasks.filter(task => task.done).length;

    $("#home-open-count").textContent = tasks.length - done;
    $("#home-done-count").textContent = done;
    $("#home-streak-count").textContent = streak.count;

    const upcoming = tasks
      .filter(task => !task.done)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 3);

    const node = $("#home-upcoming");

    if (!upcoming.length) {
      node.className = "empty-state";
      node.textContent = tasks.length
        ? "Everything is completed. Nice work!"
        : "No tasks yet. Add one when you're ready.";
      return;
    }

    node.className = "";

    node.innerHTML = upcoming.map(task => `
      <div class="upcoming-item">
        <div>
          <strong>${esc(task.name)}</strong>
          <small>${esc(task.type)}</small>
        </div>
        <small>${dateLabel(task.due)}</small>
      </div>
    `).join("");
  }

  // TASKS
  function renderTasks() {
    const list = $("#task-list");

    const visible = tasks
      .filter(task =>
        taskFilter === "all" ||
        (taskFilter === "open" && !task.done) ||
        (taskFilter === "done" && task.done)
      )
      .sort((a, b) =>
        Number(a.done) - Number(b.done) ||
        a.due.localeCompare(b.due)
      );

    $("#task-count").textContent =
      `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

    if (!visible.length) {
      list.innerHTML = `
        <div class="card empty-state">
          ${
            taskFilter === "done"
              ? "No completed tasks yet."
              : taskFilter === "open"
                ? "You're all caught up!"
                : "No tasks here yet. Add your first task above."
          }
        </div>
      `;
      return;
    }

    list.innerHTML = visible.map(task => {
      const overdue = !task.done && task.due < todayISO();

      return `
        <article class="task-item ${task.done ? "done" : ""}">
          <input
            class="task-check"
            type="checkbox"
            data-task-check="${esc(task.id)}"
            ${task.done ? "checked" : ""}
            aria-label="Mark ${esc(task.name)} complete"
          >
          <div class="task-main">
            <p class="task-name">${esc(task.name)}</p>
            <div class="task-meta">
              <span class="type-chip">${esc(task.type)}</span>
              <span class="${overdue ? "overdue" : ""}">
                ${overdue ? "Overdue · " : "Due · "}${dateLabel(task.due)}
              </span>
            </div>
          </div>
          <button
            class="delete-button"
            data-task-delete="${esc(task.id)}"
            aria-label="Delete ${esc(task.name)}"
            title="Delete task"
          >×</button>
        </article>
      `;
    }).join("");
  }

  $("#task-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#task-input").value.trim();
    const due = $("#task-due").value;

    if (!name || !due) return;

    tasks.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      due,
      type: $("#task-type").value,
      done: false
    });

    save(STORAGE.tasks, tasks);
    $("#task-form").reset();
    $("#task-due").value = todayISO();

    renderAll();
    toast("Task added!");
  });

  $("#task-due").value = todayISO();

  $("#task-list").addEventListener("change", event => {
    const id = event.target.dataset.taskCheck;
    if (!id) return;

    const task = tasks.find(item => item.id === id);
    if (!task) return;

    task.done = event.target.checked;

    save(STORAGE.tasks, tasks);
    renderAll();

    toast(
      task.done
        ? "Task completed. Nice work!"
        : "Task moved back to to-do."
    );
  });

  $("#task-list").addEventListener("click", event => {
    const button = event.target.closest("[data-task-delete]");
    if (!button) return;

    tasks = tasks.filter(task => task.id !== button.dataset.taskDelete);

    save(STORAGE.tasks, tasks);
    renderAll();
    toast("Task deleted.");
  });

  $$(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      taskFilter = button.dataset.filter;

      $$(".filter-button").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderTasks();
    });
  });

  // GWA CALCULATOR
  function renderSubjects() {
    const list = $("#subject-list");

    if (!subjects.length) {
      list.className = "stack-list empty-state";
      list.textContent = "No subjects added yet.";
      $("#gwa-result").textContent = "—";
      $("#gwa-details").textContent = "Add a subject to begin.";
      return;
    }

    list.className = "stack-list";

    list.innerHTML = subjects.map(subject => `
      <div class="subject-row">
        <div>
          <strong>${esc(subject.name)}</strong>
          <small>
            ${subject.units} unit${Number(subject.units) === 1 ? "" : "s"}
          </small>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="subject-grade">
            ${Number(subject.grade).toFixed(2)}
          </span>
          <button
            class="delete-button"
            data-subject-delete="${esc(subject.id)}"
            aria-label="Delete ${esc(subject.name)}"
          >×</button>
        </div>
      </div>
    `).join("");

    const units = subjects.reduce(
      (sum, subject) => sum + Number(subject.units), 0
    );

    const weighted = subjects.reduce(
      (sum, subject) =>
        sum + Number(subject.grade) * Number(subject.units),
      0
    );

    $("#gwa-result").textContent = (weighted / units).toFixed(2);
    $("#gwa-details").textContent =
      `${subjects.length} subject${subjects.length === 1 ? "" : "s"} · ${units.toFixed(1)} total units`;
  }

  $("#gwa-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#subject-name").value.trim();
    const grade = Number($("#subject-grade").value);
    const units = Number($("#subject-units").value);

    if (
      !name ||
      !Number.isFinite(grade) ||
      grade < 1 ||
      grade > 5 ||
      !Number.isFinite(units) ||
      units <= 0
    ) {
      toast("Enter a valid subject, grade, and unit value.");
      return;
    }

    subjects.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      grade,
      units
    });

    save(STORAGE.subjects, subjects);
    $("#gwa-form").reset();
    $("#subject-units").value = "1";

    renderSubjects();
    toast("Subject added!");
  });

  $("#subject-list").addEventListener("click", event => {
    const button = event.target.closest("[data-subject-delete]");
    if (!button) return;

    subjects = subjects.filter(
      subject => subject.id !== button.dataset.subjectDelete
    );

    save(STORAGE.subjects, subjects);
    renderSubjects();
    toast("Subject removed.");
  });

  $("#clear-subjects").addEventListener("click", () => {
    if (!subjects.length) {
      toast("There are no subjects to clear.");
      return;
    }

    if (!confirm("Clear all subjects from the GWA calculator?")) return;

    subjects = [];
    save(STORAGE.subjects, subjects);
    renderSubjects();
    toast("Subjects cleared.");
  });

  // DAILY STREAK
  function renderStreak() {
    const checked = streak.lastDate === todayISO();

    $("#streak-number").textContent = streak.count;
    $("#home-streak-count").textContent = streak.count;

    $("#check-in-button").disabled = checked;
    $("#check-in-button").textContent = checked
      ? "Checked in today ✓"
      : "Check in for today";

    $("#check-in-button").style.opacity = checked ? ".7" : "1";

    $("#streak-message").textContent = checked
      ? "You showed up for yourself today."
      : "One small check-in is enough.";

    $("#last-checkin").textContent = streak.lastDate
      ? `Last check-in: ${dateLabel(streak.lastDate)}.`
      : "You haven't checked in yet.";
  }

  $("#check-in-button").addEventListener("click", () => {
    const today = todayISO();

    if (streak.lastDate === today) {
      toast("You've already checked in today.");
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayISO =
      `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    streak.count =
      streak.lastDate === yesterdayISO ? streak.count + 1 : 1;

    streak.lastDate = today;

    save(STORAGE.streak, streak);
    renderStreak();
    renderHome();

    toast("Check-in saved. Keep going at your own pace!");
  });

  // GROWING TREE
  function renderTree() {
    const done = tasks.filter(task => task.done).length;

    let emoji = "🌱";
    let stage = "A tiny sprout";
    let next = 3;

    if (done >= 10) {
      emoji = "🌸";
      stage = "A flourishing tree";
      next = done;
    } else if (done >= 6) {
      emoji = "🌳";
      stage = "A growing tree";
      next = 10;
    } else if (done >= 3) {
      emoji = "🌿";
      stage = "A young plant";
      next = 6;
    }

    $("#tree-art").textContent = emoji;
    $("#tree-stage").textContent = stage;
    $("#tree-total").textContent =
      `${done} completed task${done === 1 ? "" : "s"} counted`;

    if (done >= 10) {
      $("#tree-progress").textContent =
        "Your tree is flourishing. Every task helped.";
      $("#tree-progress-fill").style.width = "100%";
    } else {
      const remaining = next - done;

      $("#tree-progress").textContent =
        `${remaining} more completed task${remaining === 1 ? "" : "s"} until the next stage.`;

      const progress = done < 3
        ? done / 3 * 100
        : done < 6
          ? (done - 3) / 3 * 100
          : (done - 6) / 4 * 100;

      $("#tree-progress-fill").style.width =
        `${Math.max(0, Math.min(100, progress))}%`;
    }
  }

  // MINI WORDLE
let wordList = [];
let allowedWords = new Set();
let answer = "";
let wordGuesses = [];
let wordFinished = false;
let wordleReady = false;

async function loadWords() {
  const response = await fetch("./words.txt");

  if (!response.ok) {
    throw new Error(`Error: Couldn't load word list!`);
  }

  const text = await response.text();

  wordList = text
    .split(/\s+/)
    .map(word => word.trim().toUpperCase())
    .filter(word => /^[A-Z]{5}$/.test(word));

  if (wordList.length === 0) {
    throw new Error(
      "words.txt loaded, but it contains no valid five-letter words."
    );
  }

  allowedWords = new Set(wordList);
  wordleReady = true;

  console.log(`Wordle loaded ${wordList.length} words.`);
}

function pickWord() {
  if (!wordList.length) return "";
  return wordList[Math.floor(Math.random() * wordList.length)];
}

function scoreWord(guess, target) {
  const marks = Array(5).fill("absent");
  const remaining = target.split("");

  // First, mark letters in the correct position.
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      marks[i] = "correct";
      remaining[i] = null;
    }
  }

  // Then, mark letters that exist in another position.
  for (let i = 0; i < 5; i++) {
    if (marks[i] !== "correct") {
      const idx = remaining.indexOf(guess[i]);

      if (idx !== -1) {
        marks[i] = "present";
        remaining[idx] = null;
      }
    }
  }

  return marks;
}

function renderWordBoard() {
  const board = document.getElementById("wordBoard");
  if (!board) return;

  board.innerHTML = "";

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      const tile = document.createElement("div");
      tile.className = "word-tile";

      if (wordGuesses[row]) {
        tile.textContent = wordGuesses[row].word[col];
        tile.classList.add(wordGuesses[row].marks[col]);
      }

      board.appendChild(tile);
    }
  }
}

const wordForm = document.getElementById("wordForm");
const wordInput = document.getElementById("wordInput");
const wordStatus = document.getElementById("wordleStatus");
const wordSubmitButton =
  wordForm?.querySelector("button[type='submit']");

if (wordForm && wordInput && wordStatus) {
  wordForm.addEventListener("submit", event => {
    event.preventDefault();

    if (!wordleReady) {
      wordStatus.textContent =
        "Loading the word list. Please wait a moment.";
      return;
    }

    if (wordFinished) return;

    const guess = wordInput.value.trim().toUpperCase();

    if (!/^[A-Z]{5}$/.test(guess)) {
      wordStatus.textContent = "Enter exactly five letters.";
      return;
    }

    if (!allowedWords.has(guess)) {
      wordStatus.textContent =
        "That word isn't in the word list. Try another.";
      return;
    }

    const marks = scoreWord(guess, answer);

    wordGuesses.push({ word: guess, marks });
    renderWordBoard();
    wordInput.value = "";

    if (guess === answer) {
      wordFinished = true;
      wordStatus.textContent =
        `You got it! The word was ${answer}. 🎉`;
    } else if (wordGuesses.length === 6) {
      wordFinished = true;
      wordStatus.textContent =
        `Out of tries! The word was ${answer}.`;
    } else {
      const remaining = 6 - wordGuesses.length;
      wordStatus.textContent =
        `${remaining} ${remaining === 1 ? "try" : "tries"} left.`;
    }
  });
}

function resetWordle() {
  if (!wordleReady) {
    if (wordStatus) {
      wordStatus.textContent =
        "Loading the word list. Please wait a moment.";
    }
    return;
  }

  answer = pickWord();
  wordGuesses = [];
  wordFinished = false;

  renderWordBoard();

  if (wordStatus) {
    wordStatus.textContent = "You have six tries!";
  }

  if (wordInput) {
    wordInput.value = "";
    wordInput.disabled = false;
  }

  if (wordSubmitButton) {
    wordSubmitButton.disabled = false;
  }
}

const wordleResetButton = document.getElementById("wordleReset");

if (wordleResetButton) {
  wordleResetButton.addEventListener("click", resetWordle);
}

if (wordInput) wordInput.disabled = true;
if (wordSubmitButton) wordSubmitButton.disabled = true;

if (wordStatus) {
  wordStatus.textContent = "Loading the word list…";
}

renderWordBoard();

loadWords()
  .then(() => {
    answer = pickWord();

    if (wordInput) wordInput.disabled = false;
    if (wordSubmitButton) wordSubmitButton.disabled = false;
    if (wordStatus) wordStatus.textContent = "You have six tries!";

    renderWordBoard();
  })
  .catch(error => {
    console.error("Wordle word-list error:", error);

    if (wordStatus) {
      wordStatus.textContent =
        "Could not load words.txt. Check that it is in the same folder and committed to GitHub.";
    }
  });


  // ROCK PAPER SCISSORS
  const rpsMoves = ["rock", "paper", "scissors"];

  const rpsEmoji = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️"
  };

  let rpsWins = 0;
  let rpsLosses = 0;
  let rpsTies = 0;

  function renderRpsScore() {
    $("#rps-score").textContent =
      `Wins: ${rpsWins} · Losses: ${rpsLosses} · Ties: ${rpsTies}`;
  }

  $$(".rps-choice").forEach(button => {
    button.addEventListener("click", () => {
      const player = button.dataset.choice;
      const computer =
        rpsMoves[Math.floor(Math.random() * rpsMoves.length)];

      let result;

      if (player === computer) {
        rpsTies++;
        result = "It's a tie!";
      } else if (
        (player === "rock" && computer === "scissors") ||
        (player === "paper" && computer === "rock") ||
        (player === "scissors" && computer === "paper")
      ) {
        rpsWins++;
        result = "You win this round! 🎉";
      } else {
        rpsLosses++;
        result = "I win this round. Try again!";
      }

      $("#rps-result").textContent =
        `You: ${rpsEmoji[player]} ${player} · Me: ${rpsEmoji[computer]} ${computer}. ${result}`;

      renderRpsScore();
    });
  });

  $("#rps-reset").addEventListener("click", () => {
    rpsWins = 0;
    rpsLosses = 0;
    rpsTies = 0;

    $("#rps-result").textContent =
      "Score reset! Choose your next move.";

    renderRpsScore();
  });

  // NUMBER GUESSING GAME
  let secretNumber = 0;
  let numberAttempts = 0;
  let numberFinished = false;

  const numberInput = $("#number-input");
  const numberMessage = $("#number-message");
  const numberAttemptsLabel = $("#number-attempts");
  const numberForm = $("#number-form");

  function startNumberGame() {
    secretNumber = Math.floor(Math.random() * 100) + 1;
    numberAttempts = 0;
    numberFinished = false;

    numberInput.value = "";
    numberInput.disabled = false;
    numberForm.querySelector("button[type='submit']").disabled = false;

    numberMessage.textContent = "Make your first guess!";
    numberAttemptsLabel.textContent = "Attempts: 0";
    numberInput.focus();
  }

  numberForm.addEventListener("submit", event => {
    event.preventDefault();

    if (numberFinished) return;

    const guess = Number(numberInput.value);

    if (
      !Number.isInteger(guess) ||
      guess < 1 ||
      guess > 100
    ) {
      numberMessage.textContent =
        "Enter a whole number from 1 to 100.";
      return;
    }

    numberAttempts++;
    numberAttemptsLabel.textContent = `Attempts: ${numberAttempts}`;

    if (guess === secretNumber) {
      numberFinished = true;
      numberMessage.textContent =
        `Correct! The number was ${secretNumber}. You got it in ${numberAttempts} ${numberAttempts === 1 ? "guess" : "guesses"}! 🎉`;
    } else if (guess < secretNumber) {
      numberMessage.textContent = "Too low! Try a higher number.";
    } else {
      numberMessage.textContent = "Too high! Try a lower number.";
    }

    if (numberFinished) {
      numberInput.disabled = true;
      numberForm.querySelector("button[type='submit']").disabled = true;
    }

    numberInput.value = "";
    if (!numberFinished) numberInput.focus();
  });

  $("#number-reset").addEventListener("click", startNumberGame);

  // BREAK-TIME DICE
  const breakIdeas = [
    "Stretch your shoulders and unclench your jaw.",
    "Drink some water and look away from the screen.",
    "Stand up and walk around for two minutes.",
    "Listen to one song you like.",
    "Take five slow breaths, no rushing.",
    "Tidy just one tiny part of your desk.",
    "Look outside and rest your eyes for a minute.",
    "Get a small snack if you're hungry."
  ];

  $("#roll-dice").addEventListener("click", () => {
    $("#break-prompt").textContent =
      breakIdeas[Math.floor(Math.random() * breakIdeas.length)];
  });

  // QUICK FOCUS CHALLENGE
  const challenges = [
    "Review one definition without looking at your notes.",
    "Put away five things around your study space.",
    "Write down the next three steps for an assignment.",
    "Solve one practice problem.",
    "Read one page and explain its main idea aloud.",
    "Check one deadline and prepare what you need.",
    "Finish one tiny task you've been putting off.",
    "Take a five-minute screen-free reset."
  ];

  $("#new-challenge").addEventListener("click", () => {
    $("#focus-prompt").textContent =
      challenges[Math.floor(Math.random() * challenges.length)];
  });

  // REFRESH ALL APP SECTIONS
  function renderAll() {
    renderTasks();
    renderHome();
    renderStreak();
    renderTree();
    renderSubjects();
  }

  renderAll();
  goTo("homescreen");

  // Start the games with a random answer.
  startWordle();
  startNumberGame();

  // Ask for a name only if one has not been confirmed yet.
  showNameSetup();

  // SERVICE WORKER / PWA
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch(() => {});
    });
  }
})();
