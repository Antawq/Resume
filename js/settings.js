import { CONSTANTS, THEME_PRESETS, SETTINGS_KEY } from "./constants.js";
import { escapeHtml, isLocalStorageAvailable } from "./utils.js";

// --- Persistence ---

export function loadSettings() {
  if (!isLocalStorageAvailable) return { brightness: 0, theme: "neon" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { brightness: 0, theme: "neon" };
}

export function saveSettings(settings) {
  if (!isLocalStorageAvailable) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

// --- Apply ---

export function applyBrightness(value) {
  const overlay = document.getElementById("brightness-overlay");
  if (!overlay) return;
  overlay.style.opacity = value / 100;
}

export function applyTheme(themeId) {
  const theme = THEME_PRESETS.find((t) => t.id === themeId);
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--electric-blue", theme.accent);
  root.style.setProperty("--neon-purple", theme.purple);
  root.style.setProperty("--neon-green", theme.green);
}

export const currentSettings = loadSettings();

// --- Settings window ---

export function renderSettings(windowContent) {
  windowContent.innerHTML = `
            <div class="settings-window">
                <div class="settings-section">
                    <label class="settings-label" for="brightness-slider">Brightness</label>
                    <input type="range" id="brightness-slider" class="settings-slider" min="0" max="${CONSTANTS.BRIGHTNESS_MAX}" value="${currentSettings.brightness}">
                </div>
                <div class="settings-section">
                    <span class="settings-label">Theme</span>
                    <div class="settings-swatches" id="theme-swatches">
                        ${THEME_PRESETS.map(
                          (t) => `
                            <button class="settings-swatch${t.id === currentSettings.theme ? " is-active" : ""}"
                                    data-id="${t.id}" style="background:${t.swatch}"
                                    aria-label="${escapeHtml(t.label)}"></button>
                        `,
                        ).join("")}
                    </div>
                </div>
            </div>
        `;

  windowContent
    .querySelector("#brightness-slider")
    .addEventListener("input", function () {
      currentSettings.brightness = parseInt(this.value, 10);
      applyBrightness(currentSettings.brightness);
      saveSettings(currentSettings);
    });

  windowContent
    .querySelector("#theme-swatches")
    .addEventListener("click", (e) => {
      const swatch = e.target.closest(".settings-swatch");
      if (!swatch) return;
      currentSettings.theme = swatch.dataset.id;
      applyTheme(currentSettings.theme);
      windowContent
        .querySelectorAll("#theme-swatches .settings-swatch")
        .forEach((s) => s.classList.remove("is-active"));
      swatch.classList.add("is-active");
      saveSettings(currentSettings);
    });
}
