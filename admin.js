const ADMIN_DAYS = [
  { id: "mon", label: "Понедельник" },
  { id: "tue", label: "Вторник" },
  { id: "wed", label: "Среда" },
  { id: "thu", label: "Четверг" },
  { id: "fri", label: "Пятница" }
];

const ADMIN_TIMES = [
  { id: "10", label: "10:00–11:00" },
  { id: "11", label: "11:00–12:00" },
  { id: "12", label: "12:00–13:00" },
  { id: "13", label: "13:00–14:00" },
  { id: "14", label: "14:00–15:00" },
  { id: "15", label: "15:00–16:00" },
  { id: "16", label: "16:00–17:00" },
  { id: "17", label: "17:00–18:00" }
];

let adminClosedSlotIds = new Set();
let adminPassword = "";

const loginCard = document.getElementById("loginCard");
const adminPanel = document.getElementById("adminPanel");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPasswordInput = document.getElementById("adminPassword");
const adminScheduleGrid = document.getElementById("adminScheduleGrid");
const adminStatus = document.getElementById("adminStatus");
const adminMessage = document.getElementById("adminMessage");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

document.addEventListener("DOMContentLoaded", () => {
  const savedPassword = sessionStorage.getItem("psyAdminPassword");

  if (savedPassword) {
    checkPasswordAndEnter(savedPassword);
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = adminPasswordInput.value.trim();

  if (!password) {
    showAdminMessage("Введите пароль администратора.", "error");
    return;
  }

  await checkPasswordAndEnter(password);
});

refreshButton.addEventListener("click", async () => {
  await loadAdminClosedSlots();
});

logoutButton.addEventListener("click", () => {
  adminPassword = "";
  sessionStorage.removeItem("psyAdminPassword");

  adminPanel.classList.add("hidden");
  loginCard.classList.remove("hidden");
  adminPasswordInput.value = "";

  showAdminMessage("", "");
});

function getAdminApiUrl() {
  if (!window.PSY_CONFIG || !window.PSY_CONFIG.API_URL) {
    showAdminMessage("Не настроен файл config.js: не указана ссылка на Google Apps Script.", "error");
    return "";
  }

  return window.PSY_CONFIG.API_URL;
}

async function checkPasswordAndEnter(password) {
  const apiUrl = getAdminApiUrl();

  if (!apiUrl) {
    return;
  }

  showAdminMessage("Проверяем пароль…", "success");

  try {
    const response = await adminJsonp(apiUrl, {
      action: "checkAdmin",
      password
    });

    if (!response.ok) {
      throw new Error(response.error || "Неверный пароль администратора.");
    }

    adminPassword = password;
    sessionStorage.setItem("psyAdminPassword", password);

    loginCard.classList.add("hidden");
    adminPanel.classList.remove("hidden");

    showAdminMessage("", "");
    await loadAdminClosedSlots();

  } catch (error) {
    console.error(error);
    adminPassword = "";
    sessionStorage.removeItem("psyAdminPassword");
    showAdminMessage(error.message || "Не удалось войти. Проверьте пароль.", "error");
  }
}

function makeAdminSlotId(dayId, timeId) {
  return `${dayId}-${timeId}`;
}

function makeAdminSlotLabel(dayLabel, timeLabel) {
  return `${dayLabel}, ${timeLabel}`;
}

async function loadAdminClosedSlots() {
  const apiUrl = getAdminApiUrl();

  if (!apiUrl) {
    adminStatus.textContent = "Ошибка настройки сайта.";
    return;
  }

  adminStatus.textContent = "Загружаем расписание…";

  try {
    const response = await adminJsonp(apiUrl, {
      action: "getSlots"
    });

    if (!response.ok) {
      throw new Error(response.error || "Не удалось загрузить расписание.");
    }

    adminClosedSlotIds = new Set(
      (response.closedSlots || []).map((slot) => String(slot.slotId))
    );

    adminStatus.textContent = "Расписание загружено.";
    renderAdminSchedule();

  } catch (error) {
    console.error(error);
    adminStatus.textContent = "Не удалось загрузить закрытые слоты.";
    showAdminMessage("Не удалось загрузить расписание. Проверьте ссылку в config.js и публикацию Apps Script.", "error");
  }
}

function renderAdminSchedule() {
  adminScheduleGrid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "schedule-cell header";
  corner.textContent = "Время";
  adminScheduleGrid.appendChild(corner);

  ADMIN_DAYS.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "schedule-cell header";
    cell.textContent = day.label;
    adminScheduleGrid.appendChild(cell);
  });

  ADMIN_TIMES.forEach((time, timeIndex) => {
    const timeCell = document.createElement("div");
    timeCell.className = "schedule-cell time";
    timeCell.textContent = time.label;
    adminScheduleGrid.appendChild(timeCell);

    ADMIN_DAYS.forEach((day, dayIndex) => {
      const slotId = makeAdminSlotId(day.id, time.id);
      const label = makeAdminSlotLabel(day.label, time.label);
      const isClosed = adminClosedSlotIds.has(slotId);

      const cell = document.createElement("div");
cell.className = "schedule-cell slot-cell";
cell.dataset.label = label;
cell.style.setProperty("--mobile-order", String(dayIndex * 100 + timeIndex));

      const slotBox = document.createElement("div");
      slotBox.className = isClosed ? "admin-slot closed" : "admin-slot";

      const title = document.createElement("div");
      title.className = "admin-slot-title";
      title.textContent = isClosed ? "Закрыто" : "Открыто";

      const actions = document.createElement("div");
      actions.className = "admin-slot-actions";

      const button = document.createElement("button");
      button.type = "button";

      if (isClosed) {
        button.className = "open";
        button.textContent = "Открыть";
        button.addEventListener("click", () => openAdminSlot({
          slotId,
          label,
          dayLabel: day.label,
          time: time.label
        }));
      } else {
        button.className = "close";
        button.textContent = "Закрыть";
        button.addEventListener("click", () => closeAdminSlot({
          slotId,
          label,
          dayLabel: day.label,
          time: time.label
        }));
      }

      actions.appendChild(button);
      slotBox.appendChild(title);
      slotBox.appendChild(actions);
      cell.appendChild(slotBox);
      adminScheduleGrid.appendChild(cell);
    });
  });
}

async function closeAdminSlot(slot) {
  const apiUrl = getAdminApiUrl();

  if (!apiUrl) {
    return;
  }

  if (!adminPassword) {
    showAdminMessage("Сначала войдите с паролем администратора.", "error");
    return;
  }

  showAdminMessage(`Закрываем слот: ${slot.label}…`, "success");

  try {
    const response = await adminJsonp(apiUrl, {
      action: "closeSlot",
      password: adminPassword,
      slotId: slot.slotId,
      dayLabel: slot.dayLabel,
      time: slot.time,
      reason: "закрыто администратором"
    });

    if (!response.ok) {
      throw new Error(response.error || "Не удалось закрыть слот.");
    }

    adminClosedSlotIds.add(slot.slotId);
    renderAdminSchedule();

    showAdminMessage(`Слот закрыт: ${slot.label}.`, "success");

  } catch (error) {
    console.error(error);
    showAdminMessage(error.message || "Слот не закрылся. Проверьте пароль администратора и настройки Apps Script.", "error");
  }
}

async function openAdminSlot(slot) {
  const apiUrl = getAdminApiUrl();

  if (!apiUrl) {
    return;
  }

  if (!adminPassword) {
    showAdminMessage("Сначала войдите с паролем администратора.", "error");
    return;
  }

  showAdminMessage(`Открываем слот: ${slot.label}…`, "success");

  try {
    const response = await adminJsonp(apiUrl, {
      action: "openSlot",
      password: adminPassword,
      slotId: slot.slotId
    });

    if (!response.ok) {
      throw new Error(response.error || "Не удалось открыть слот.");
    }

    adminClosedSlotIds.delete(slot.slotId);
    renderAdminSchedule();

    showAdminMessage(`Слот открыт: ${slot.label}.`, "success");

  } catch (error) {
    console.error(error);
    showAdminMessage(error.message || "Слот не открылся. Проверьте пароль администратора и настройки Apps Script.", "error");
  }
}

function adminJsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `psyAdminCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");

    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}${query.toString()}`;

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Ошибка соединения с Google Apps Script."));
    };

    function cleanup() {
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    document.body.appendChild(script);
  });
}

function showAdminMessage(text, type) {
  if (!text) {
    adminMessage.hidden = true;
    adminMessage.textContent = "";
    adminMessage.className = "message";
    return;
  }

  adminMessage.hidden = false;
  adminMessage.textContent = text;
  adminMessage.className = `message ${type}`;
}
