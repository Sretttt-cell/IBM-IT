/**
 * script.js — Task List App
 *
 * Architecture:
 *  - State: a plain array of task objects stored in localStorage.
 *  - Render: fully declarative — every state change calls render().
 *  - No external libraries; Vanilla JS only.
 *
 * Task object shape:
 *  { id: string, text: string, completed: boolean, createdAt: number }
 */

/* ============================================================
   1. STATE
   ============================================================ */

/** @type {{ id: string, text: string, completed: boolean, createdAt: number }[]} */
let tasks = [];

/** Currently active filter: "all" | "active" | "completed" */
let currentFilter = "all";

/** ID of the task being edited in the modal (null when modal is closed) */
let editingTaskId = null;

/* ============================================================
   2. DOM REFERENCES
   ============================================================ */
const taskForm       = document.getElementById("task-form");
const taskInput      = document.getElementById("task-input");
const errorMsg       = document.getElementById("error-msg");
const taskList       = document.getElementById("task-list");
const emptyState     = document.getElementById("empty-state");
const emptyLabel     = document.getElementById("empty-label");
const taskCounter    = document.getElementById("task-counter");
const clearCompleted = document.getElementById("clear-completed");
const filterBtns     = document.querySelectorAll(".filter-btn");

// Edit modal elements
const editModal    = document.getElementById("edit-modal");
const editInput    = document.getElementById("edit-input");
const modalCancel  = document.getElementById("modal-cancel");
const modalSave    = document.getElementById("modal-save");

/* ============================================================
   3. PERSISTENCE — localStorage helpers
   ============================================================ */

/** Load tasks from localStorage into the tasks array. */
function loadTasks() {
  try {
    const stored = localStorage.getItem("taskList_tasks");
    tasks = stored ? JSON.parse(stored) : [];
  } catch {
    tasks = [];
  }
}

/** Persist the current tasks array to localStorage. */
function saveTasks() {
  localStorage.setItem("taskList_tasks", JSON.stringify(tasks));
}

/* ============================================================
   4. UTILITY HELPERS
   ============================================================ */

/** Generate a short unique ID based on timestamp + random string. */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Escape HTML to prevent XSS when inserting task text into innerHTML. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Return only the tasks that match the current filter. */
function getFilteredTasks() {
  if (currentFilter === "active")    return tasks.filter((t) => !t.completed);
  if (currentFilter === "completed") return tasks.filter((t) =>  t.completed);
  return tasks; // "all"
}

/* ============================================================
   5. RENDER — builds the task list DOM from state
   ============================================================ */

/**
 * Full render cycle. Called after every state change.
 * Re-builds the task list, updates the counter, toggles empty state,
 * and shows/hides the "Clear completed" button.
 */
function render() {
  const filtered       = getFilteredTasks();
  const activeCount    = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) =>  t.completed).length;

  // ── Task counter text ──
  taskCounter.textContent =
    `${activeCount} task${activeCount !== 1 ? "s" : ""} remaining`;

  // ── Clear completed button visibility ──
  if (completedCount > 0) {
    clearCompleted.classList.remove("hidden");
  } else {
    clearCompleted.classList.add("hidden");
  }

  // ── Empty state ──
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    emptyLabel.textContent =
      tasks.length === 0
        ? "No tasks yet. Add one above!"
        : `No ${currentFilter} tasks.`;
    taskList.innerHTML = "";
    return;
  }
  emptyState.classList.add("hidden");

  // ── Build task items ──
  taskList.innerHTML = filtered
    .map((task) => renderTaskItem(task))
    .join("");
}

/**
 * Returns the HTML string for a single task item.
 * @param {{ id: string, text: string, completed: boolean }} task
 * @returns {string}
 */
function renderTaskItem(task) {
  const completedClass = task.completed ? "completed" : "";
  const checkedAttr    = task.completed ? "checked" : "";
  const safeText       = escapeHtml(task.text);

  return `
    <li
      class="task-item ${completedClass}"
      data-id="${task.id}"
      role="listitem"
    >
      <!-- Toggle checkbox -->
      <input
        type="checkbox"
        class="task-checkbox"
        ${checkedAttr}
        aria-label="Mark task as ${task.completed ? "active" : "completed"}"
        data-action="toggle"
        data-id="${task.id}"
      />

      <!-- Task text -->
      <span class="task-text">${safeText}</span>

      <!-- Action buttons -->
      <div class="task-actions" role="group" aria-label="Task actions">
        <!-- Edit button -->
        <button
          class="action-btn edit-btn"
          data-action="edit"
          data-id="${task.id}"
          aria-label="Edit task"
          title="Edit"
        >
          <!-- Pencil icon -->
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Delete button -->
        <button
          class="action-btn delete-btn"
          data-action="delete"
          data-id="${task.id}"
          aria-label="Delete task"
          title="Delete"
        >
          <!-- Trash icon -->
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </li>
  `;
}

/* ============================================================
   6. CRUD OPERATIONS
   ============================================================ */

/**
 * CREATE — Add a new task to the array and re-render.
 * @param {string} text
 */
function addTask(text) {
  const newTask = {
    id:        generateId(),
    text:      text.trim(),
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(newTask); // newest task at top
  saveTasks();
  render();

  // Brief "slide-in" animation on the newly added list item
  const firstItem = taskList.querySelector(".task-item");
  if (firstItem) {
    firstItem.classList.add("animate-in");
    firstItem.addEventListener(
      "animationend",
      () => firstItem.classList.remove("animate-in"),
      { once: true }
    );
  }
}

/**
 * TOGGLE — Flip the completed status of a task.
 * @param {string} id
 */
function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

/**
 * UPDATE — Save the edited text for a task.
 * @param {string} id
 * @param {string} newText
 */
function updateTask(id, newText) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.text = newText.trim();
  saveTasks();
  render();
}

/**
 * DELETE — Remove a task from the array.
 * @param {string} id
 */
function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

/** DELETE ALL COMPLETED — Remove every completed task at once. */
function clearCompletedTasks() {
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  render();
}

/* ============================================================
   7. MODAL — Edit task dialog
   ============================================================ */

/**
 * Open the edit modal pre-filled with the task's current text.
 * @param {string} id
 */
function openEditModal(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  editingTaskId   = id;
  editInput.value = task.text;

  editModal.classList.remove("hidden");
  editInput.focus();
  editInput.select();
}

/** Close the edit modal and clear editing state. */
function closeEditModal() {
  editModal.classList.add("hidden");
  editingTaskId = null;
  editInput.value = "";
}

/** Save changes from the modal input. */
function saveEditModal() {
  const newText = editInput.value.trim();
  if (!newText) {
    editInput.focus();
    return;
  }
  updateTask(editingTaskId, newText);
  closeEditModal();
}

/* ============================================================
   8. EVENT HANDLERS
   ============================================================ */

// ── Add task form submit ──
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();

  if (!text) {
    // Show inline error
    errorMsg.classList.remove("hidden");
    taskInput.focus();
    return;
  }

  // Hide error if previously shown
  errorMsg.classList.add("hidden");

  addTask(text);
  taskInput.value = "";
  taskInput.focus();
});

// Hide error as soon as the user starts typing again
taskInput.addEventListener("input", () => {
  if (!errorMsg.classList.contains("hidden")) {
    errorMsg.classList.add("hidden");
  }
});

// ── Task list — event delegation for toggle / edit / delete ──
// Using a single listener on the list for better performance.
taskList.addEventListener("click", (e) => {
  const btn    = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  if (action === "toggle") toggleTask(id);
  if (action === "edit")   openEditModal(id);
  if (action === "delete") deleteTask(id);
});

// ── Filter buttons ──
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;

    // Update active styles and aria-selected
    filterBtns.forEach((b) => {
      b.classList.remove("active-filter");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active-filter");
    btn.setAttribute("aria-selected", "true");

    render();
  });
});

// ── Clear completed ──
clearCompleted.addEventListener("click", clearCompletedTasks);

// ── Modal: Save via button ──
modalSave.addEventListener("click", saveEditModal);

// ── Modal: Cancel via button ──
modalCancel.addEventListener("click", closeEditModal);

// ── Modal: Save via Enter key ──
editInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveEditModal();
  if (e.key === "Escape") closeEditModal();
});

// ── Modal: Close when clicking the overlay backdrop ──
editModal.addEventListener("click", (e) => {
  // Only close if the user clicked the overlay itself, not the inner card
  if (e.target === editModal) closeEditModal();
});

/* ============================================================
   9. INIT — Bootstrap the app on page load
   ============================================================ */
(function init() {
  loadTasks();
  render();
})();
