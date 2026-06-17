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
    adminPassword = savedPassword;
    showAdminPanel();
  } else {
    renderAdminSchedule();
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = adminPasswordInput.value.trim();

  if (!password) {
    showAdminMessage("Введите пароль администратора.", "error");
    return;
  }

  adminPassword = password;
  sessionStorage.setItem("psyAdminPassword", password);

  showAdminPanel();
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

function showAdminPanel() {
  loginCard.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  loadAdminClosedSlots();
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

  ADMIN_TIMES.forEach((time) => {
    const timeCell = document.createElement("div");
    timeCell.className = "schedule-cell time";
    timeCell.textContent = time.label;
    adminScheduleGrid.appendChild(timeCell);

    ADMIN_DAYS.forEach((day) => {
      const slotId = makeAdminSlotId(day.id, time.id);
      const label = makeAdminSlotLabel(day.label, time.label);
      const isClosed = adminClosedSlotIds.has(slotId);

      const cell = document.createElement("div");
      cell.className = "schedule-cell";

      const slotBox = document.createElement("div");
      slotBox.className = isClosed ? "admin-slot closed" : "admin-slot";

      const title = document.createElement("div");
      title.className = "admin-slot-title";
      title.textContent = isClosed ? "Закрыто" : "Открыто";

      const actions = document.createElement("div");
      actions.className = "admin-slot-actions";

      const button = document.createElement("button");

      if (isClosed) {
        button.className = "open";
        button.type = "button";
        button.textContent = "Открыть";
        button.addEventListener("click", () => openAdminSlot({ slotId, label, dayLabel: day.label, time: time.label }));
      } else {
        button.className = "close";
        button.type = "button";
        button.textContent = "Закрыть";
        button.addEventListener("click", () => closeAdminSlot({ slotId, label, dayLabel: day.label, time: time.label }));
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
  if (!adminPassword) {
    showAdminMessage("Сначала войдите с паролем администратора.", "error");
    return;
  }

  showAdminMessage(`Закрываем слот: ${slot.label}…`, "success");

  await sendAdminAction("closeSlot", {
    slotId: slot.slotId,
    dayLabel: slot.dayLabel,
    time: slot.time,
    reason: "закрыто администратором"
  });

  await wait(900);
  await loadAdminClosedSlots();

  if (adminClosedSlotIds.has(slot.slotId)) {
    showAdminMessage(`Слот закрыт: ${slot.label}.`, "success");
  } else {
    showAdminMessage("Слот не закрылся. Проверьте пароль администратора и настройки Apps Script.", "error");
  }
}

async function openAdminSlot(slot) {
  if (!adminPassword) {
    showAdminMessage("Сначала войдите с паролем администратора.", "error");
    return;
  }

  showAdminMessage(`Открываем слот: ${slot.label}…`, "success");

  await sendAdminAction("openSlot", {
    slotId: slot.slotId,
    dayLabel: slot.dayLabel,
    time: slot.time
  });

  await wait(900);
  await loadAdminClosedSlots();

  if (!adminClosedSlotIds.has(slot.slotId)) {
    showAdminMessage(`Слот открыт: ${slot.label}.`, "success");
  } else {
    showAdminMessage("Слот не открылся. Проверьте пароль администратора и настройки Apps Script.", "error");
  }
}

async function sendAdminAction(action, data) {
  const apiUrl = getAdminApiUrl();

  if (!apiUrl) {
    return;
  }

  const payload = {
    action,
    password: adminPassword,
    data
  };

  await postToAppsScript(apiUrl, payload);
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postToAppsScript(url, payload) {
  return new Promise((resolve) => {
    const iframeName = `psyAdminPostFrame_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.target = iframeName;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    form.appendChild(input);
    document.body.appendChild(form);

    const timer = setTimeout(() => {
      cleanup();
      resolve({ ok: true });
    }, 1500);

    iframe.onload = () => {
      clearTimeout(timer);
      setTimeout(() => {
        cleanup();
        resolve({ ok: true });
      }, 200);
    };

    function cleanup() {
      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }

      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }

    form.submit();
  });
}
