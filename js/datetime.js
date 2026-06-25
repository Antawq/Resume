import { CONSTANTS } from "./constants.js";

const datetimeEl = document.getElementById("datetime");

const DATE_FORMATTERS = {
  menu: new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
};

let dateTimerId = null;

export function updateDateTime() {
  try {
    if (datetimeEl)
      datetimeEl.textContent = DATE_FORMATTERS.menu
        .format(new Date())
        .replace(",", "");
  } catch (e) {
    console.error("Error updating datetime:", e);
  }
}

export function setupDateTime() {
  updateDateTime();
  if (dateTimerId === null) {
    dateTimerId = window.setInterval(updateDateTime, CONSTANTS.UPDATE_INTERVAL);
  }
}

export function teardownDateTime() {
  if (dateTimerId !== null) {
    clearInterval(dateTimerId);
    dateTimerId = null;
  }
}
