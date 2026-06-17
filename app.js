const DAYS = [
  { id: "mon", label: "Понедельник" },
  { id: "tue", label: "Вторник" },
  { id: "wed", label: "Среда" },
  { id: "thu", label: "Четверг" },
  { id: "fri", label: "Пятница" }
];

const TIMES = [
  { id: "10", label: "10:00–11:00" },
  { id: "11", label: "11:00–12:00" },
  { id: "12", label: "12:00–13:00" },
  { id: "13", label: "13:00–14:00" },
  { id: "14", label: "14:00–15:00" },
  { id: "15", label: "15:00–16:00" },
  { id: "16", label: "16:00–17:00" },
  { id: "17", label: "17:00–18:00" }
];

const selectedSlots = new Map();
let closedSlotIds = new Set();

const scheduleGrid = document.getElementById("scheduleGrid");
const scheduleStatus = document.getElementById("scheduleStatus");
const selectedSummary = document.getElementById("selectedSummary");
const form = document.getElementById("consultForm");
const statusMessage = document.getElementById("statusMessage");
const submitButton = document.getElementById("submitButton");

document.addEventListener("DOMContentLoaded", async () => {
  renderSchedule();
  await loadClosedSlots();
});

function getApiUrl() {
  if (!window.PSY_CONFIG || !window.PSY_CONFIG.API_URL) {
    showMessage("Не настроен файл config.js: не указана ссылка на Google Apps Script.", "error");
    return "";
  }

  return window.PSY_CONFIG.API_URL;
}

function makeSlotId(dayId, timeId) {
  return `${dayId}-${timeId}`;
}

function makeSlotLabel(dayLabel, timeLabel) {
  return `${dayLabel}, ${timeLabel}`;
}

function renderSchedule() {
  scheduleGrid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "schedule-cell header";
  corner.textContent = "Время";
  scheduleGrid.appendChild(corner);

  DAYS.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "schedule-cell header";
    cell.textContent = day.label;
    scheduleGrid.appendChild(cell);
  });

  TIMES.forEach((time) => {
    const timeCell = document.createElement("div");
    timeCell.className = "schedule-cell time";
    timeCell.textContent = time.label;
    scheduleGrid.appendChild(timeCell);

    DAYS.forEach((day) => {
      const slotId = makeSlotId(day.id, time.id);
      const label = makeSlotLabel(day.label, time.label);
      const isClosed = closedSlotIds.has(slotId);
      const isSelected = selectedSlots.has(slotId);

      const cell = document.createElement("div");
cell.className = "schedule-cell slot-cell";
cell.dataset.label = label;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";

      if (isSelected) {
        button.classList.add("selected");
      }

      if (isClosed) {
        button.classList.add("closed");
        button.disabled = true;
        button.textContent = "Недоступно";
      } else {
        button.textContent = isSelected ? "Выбрано" : "Выбрать";
      }

      button.addEventListener("click", () => {
        toggleSlot({
          slotId,
          label,
          dayLabel: day.label,
          time: time.label
        });
      });

      cell.appendChild(button);
      scheduleGrid.appendChild(cell);
    });
  });

  updateSelectedSummary();
}

function toggleSlot(slot) {
  if (closedSlotIds.has(slot.slotId)) {
    return;
  }

  if (selectedSlots.has(slot.slotId)) {
    selectedSlots.delete(slot.slotId);
  } else {
    selectedSlots.set(slot.slotId, slot);
  }

  renderSchedule();
}

function updateSelectedSummary() {
  const values = Array.from(selectedSlots.values());

  if (!values.length) {
    selectedSummary.textContent = "Пока ничего не выбрано.";
    return;
  }

  selectedSummary.textContent = values.map((slot) => slot.label).join("; ");
}

async function loadClosedSlots() {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    scheduleStatus.textContent = "Ошибка настройки сайта.";
    return;
  }

  scheduleStatus.textContent = "Загружаем расписание…";

  try {
    const response = await jsonp(apiUrl, {
      action: "getSlots"
    });

    if (!response.ok) {
      throw new Error(response.error || "Не удалось загрузить расписание.");
    }

    closedSlotIds = new Set(
      (response.closedSlots || []).map((slot) => String(slot.slotId))
    );

    scheduleStatus.textContent = "Расписание загружено.";
    renderSchedule();
  } catch (error) {
    console.error(error);
    scheduleStatus.textContent = "Не удалось загрузить закрытые слоты. Попробуйте обновить страницу.";
  }
}

function jsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `psyCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return;
  }

  const fullName = document.getElementById("fullName").value.trim();
  const group = document.getElementById("group").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const problem = document.getElementById("problem").value.trim();
  const consent = document.getElementById("consent").checked;
  const selected = Array.from(selectedSlots.values());

  if (!fullName || !group || !contact || !problem) {
    showMessage("Пожалуйста, заполните все обязательные поля.", "error");
    return;
  }

  if (!consent) {
    showMessage("Для отправки заявки нужно согласие на обработку персональных данных.", "error");
    return;
  }

  if (!selected.length) {
    showMessage("Пожалуйста, выберите хотя бы один удобный временной слот.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Отправляем…";
  hideMessage();

  const payload = {
    action: "submitApplication",
    data: {
      fullName,
      group,
      contact,
      problem,
      consent,
      selectedSlots: selected,
      pageUrl: window.location.href,
      submittedAtClient: new Date().toLocaleString("ru-RU")
    }
  };

  try {
    await postToAppsScript(apiUrl, payload);

    form.reset();
    selectedSlots.clear();
    renderSchedule();

    showMessage(
      "Заявка отправлена. Специалист свяжется с вами для согласования времени консультации.",
      "success"
    );
  } catch (error) {
    console.error(error);
    showMessage(
      "Не удалось отправить заявку. Проверьте интернет-соединение и попробуйте ещё раз.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Отправить заявку";
  }
});

function showMessage(text, type) {
  statusMessage.hidden = false;
  statusMessage.textContent = text;
  statusMessage.className = `message ${type}`;
}

function hideMessage() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
  statusMessage.className = "message";
}

function postToAppsScript(url, payload) {
  return new Promise((resolve) => {
    const iframeName = `psyPostFrame_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

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
