import { currentSettings, applyBrightness, applyTheme } from "./settings.js";
import { setupDateTime, teardownDateTime } from "./datetime.js";
import { setupFileDragging, setupDockItems } from "./desktop.js";
import { closeTopWindow } from "./window-manager.js";

document.addEventListener(
  "error",
  (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && t.getAttribute("src")) t.style.display = "none";
  },
  true,
);

function setupStartupOverlay() {
  const startupOverlay = document.getElementById("startup-overlay");
  if (!startupOverlay) return;

  startupOverlay.addEventListener(
    "animationend",
    () => {
      startupOverlay.remove();
    },
    { once: true },
  );
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeTopWindow();
});

window.addEventListener("beforeunload", () => {
  teardownDateTime();
});

// --- Boot ---

function init() {
  setupStartupOverlay();
  applyBrightness(currentSettings.brightness);
  applyTheme(currentSettings.theme);
  setupDateTime();
  setupFileDragging();
  setupDockItems();
}

init();
