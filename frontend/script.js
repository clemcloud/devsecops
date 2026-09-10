// frontend/script.js

const API_URL = "http://localhost:8000";
let token = null;

// ---- Register ----
async function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const messageEl = document.getElementById("auth-message");

    if (response.ok) {
        messageEl.textContent = "Registered! Now log in.";
    } else {
        const error = await response.json();
        messageEl.textContent = `Error: ${error.detail}`;
    }
}

// ---- Login ----
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // FastAPI's OAuth2PasswordRequestForm expects form data, not JSON
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
    });

    const messageEl = document.getElementById("auth-message");

    if (response.ok) {
        const data = await response.json();
        token = data.access_token;
        messageEl.textContent = "";
        document.getElementById("auth-section").style.display = "none";
        document.getElementById("task-section").style.display = "block";
        loadTasks();
    } else {
        messageEl.textContent = "Login failed. Check your credentials.";
    }
}

// ---- Logout ----
function logout() {
    token = null;
    document.getElementById("task-section").style.display = "none";
    document.getElementById("auth-section").style.display = "block";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
}

// ---- Load tasks ----
async function loadTasks() {
    const response = await fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const tasks = await response.json();
    const list = document.getElementById("task-list");
    list.innerHTML = "";

    tasks.forEach((task) => {
        const li = document.createElement("li");
        li.textContent = `${task.title} [${task.status}] `;

        const doneBtn = document.createElement("button");
        doneBtn.textContent = "Mark Done";
        doneBtn.onclick = () => updateTask(task.id);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => deleteTask(task.id);

        li.appendChild(doneBtn);
        li.appendChild(deleteBtn);
        list.appendChild(li);
    });
}

// ---- Create task ----
async function createTask() {
    const title = document.getElementById("task-title").value;

    await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
    });

    document.getElementById("task-title").value = "";
    loadTasks();
}

// ---- Update task (mark done) ----
async function updateTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "done" }),
    });

    loadTasks();
}

// ---- Delete task ----
async function deleteTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });

    loadTasks();
}