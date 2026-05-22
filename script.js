"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const CONSTANTS = {
    PADDING: 20,
    UPDATE_INTERVAL: 1000,
    DRAG_THRESHOLD: 5,
    DESKTOP_PADDING_TOP: 50,
    DESKTOP_PADDING_BOTTOM: 80,
    OPEN_DEBOUNCE_MS: 100,
    BRIGHTNESS_MAX: 70,
    WINDOW_DRAG_MARGIN: 80,
    WINDOW_CASCADE_STEP: 32,
    WINDOW_MIN_WIDTH: 320,
    WINDOW_MIN_HEIGHT: 220,
  };

  document.addEventListener("error", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && t.getAttribute("src")) t.style.display = "none";
  }, true);

  // DOM elements
  const files = document.querySelectorAll(".file");
  const windowTemplate = document.getElementById("window-template");
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

  const folderContents = {
    photos: [
      { src: "photos/photo1.png", name: "Photo 1" },
      { src: "photos/photo2.png", name: "Photo 2" },
      { src: "photos/photo3.png", name: "Photo 3" },
    ],
    projects: [],
    trash: [],
  };

  let currentIndex = { photos: 0, projects: 0, trash: 0 };

  const GITHUB_PROFILES = [
    { username: "swid-yera", prefix: "gh-main" },
    { username: "Antawq", prefix: "gh-alt" },
  ];

  let githubDataPromise = null;

  const isLocalStorageAvailable = (() => {
    try {
      const k = "__gh_cache_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      console.warn("LocalStorage недоступен.", e);
      return false;
    }
  })();

  const telegramState = {
    chats: [
      {
        id: 1,
        name: "Alice",
        avatar: "photos/photo1.jpg",
        messages: [{ type: "received", text: "Hi there!" }],
      },
      {
        id: 2,
        name: "Bob",
        avatar: "photos/photo2.jpg",
        messages: [{ type: "received", text: "Hello!" }],
      },
    ],
    activeChatId: 1,
  };

  const THEME_PRESETS = [
    {
      id: "neon",
      label: "Neon",
      accent: "#0038ff",
      purple: "#BB86FC",
      green: "#03DAC6",
      swatch: "#0038ff",
    },
    {
      id: "rose",
      label: "Rosé",
      accent: "#F4A0B5",
      purple: "#D4A0E0",
      green: "#F0C0A0",
      swatch: "#F4A0B5",
    },
    {
      id: "forest",
      label: "Forest",
      accent: "#4CAF50",
      purple: "#81C784",
      green: "#A5D6A7",
      swatch: "#4CAF50",
    },
    {
      id: "amber",
      label: "Amber",
      accent: "#FFB300",
      purple: "#FFD54F",
      green: "#FFCA28",
      swatch: "#FFB300",
    },
    {
      id: "mono",
      label: "Mono",
      accent: "#AAAAAA",
      purple: "#888888",
      green: "#CCCCCC",
      swatch: "#AAAAAA",
    },
  ];

  const SETTINGS_KEY = "desktop-settings";

  // --- Utilities ---

  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function loadSettings() {
    if (!isLocalStorageAvailable) return { brightness: 0, theme: "neon" };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { brightness: 0, theme: "neon" };
  }

  function saveSettings(settings) {
    if (!isLocalStorageAvailable) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function applyBrightness(value) {
    const overlay = document.getElementById("brightness-overlay");
    if (!overlay) return;
    overlay.style.opacity = value / 100;
  }

  function applyTheme(themeId) {
    const theme = THEME_PRESETS.find((t) => t.id === themeId);
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty("--electric-blue", theme.accent);
    root.style.setProperty("--neon-purple", theme.purple);
    root.style.setProperty("--neon-green", theme.green);
  }

  let currentSettings = loadSettings();

  // --- Init ---

  function init() {
    setupStartupOverlay();
    applyBrightness(currentSettings.brightness);
    applyTheme(currentSettings.theme);
    setupDateTime();
    setupFileDragging();
    setupDockItems();
  }

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

  // --- DateTime ---

  function updateDateTime() {
    try {
      if (datetimeEl)
        datetimeEl.textContent = DATE_FORMATTERS.menu
          .format(new Date())
          .replace(",", "");
    } catch (e) {
      console.error("Error updating datetime:", e);
    }
  }

  function setupDateTime() {
    updateDateTime();
    if (dateTimerId === null) {
      dateTimerId = window.setInterval(
        updateDateTime,
        CONSTANTS.UPDATE_INTERVAL,
      );
    }
  }

  // --- Settings ---

  function renderSettings(windowContent) {
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

  // --- File Dragging — Pointer Events ---

  function setupFileDragging() {
    files.forEach((file) => {
      let isDragging = false;
      let hasMoved = false;
      let opening = false;
      let offsetX = 0,
        offsetY = 0;
      let startX = 0,
        startY = 0;

      file.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        file.setPointerCapture(e.pointerId);
        isDragging = false;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = file.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      });

      file.addEventListener("pointermove", (e) => {
        if (!file.hasPointerCapture(e.pointerId)) return;

        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);

        if (
          !isDragging &&
          (dx > CONSTANTS.DRAG_THRESHOLD || dy > CONSTANTS.DRAG_THRESHOLD)
        ) {
          isDragging = true;
          file.classList.add("dragging");
        }
        if (!isDragging) return;

        hasMoved = true;
        const maxX = window.innerWidth - file.offsetWidth - CONSTANTS.PADDING;
        const maxY =
          window.innerHeight - file.offsetHeight - CONSTANTS.PADDING - CONSTANTS.DESKTOP_PADDING_BOTTOM;
        const minY = CONSTANTS.PADDING + CONSTANTS.DESKTOP_PADDING_TOP;

        file.style.left =
          Math.max(CONSTANTS.PADDING, Math.min(e.clientX - offsetX, maxX)) +
          "px";
        file.style.top =
          Math.max(minY, Math.min(e.clientY - offsetY, maxY)) + "px";
      });

      file.addEventListener("pointerup", () => {
        if (!hasMoved && !opening) {
          opening = true;
          openWindow(file.dataset.type);
          setTimeout(() => {
            opening = false;
          }, CONSTANTS.OPEN_DEBOUNCE_MS);
        }
        if (isDragging) file.classList.remove("dragging");
        isDragging = false;
        hasMoved = false;
      });

      file.addEventListener("pointercancel", () => {
        if (isDragging) file.classList.remove("dragging");
        isDragging = false;
        hasMoved = false;
      });

      file.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openWindow(file.dataset.type);
        }
      });
    });
  }

  // --- Dock Items ---

  function setupDockItems() {
    document.querySelectorAll(".dock-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        openWindow(item.dataset.type);
      });
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openWindow(item.dataset.type);
        }
      });
    });
  }

  // --- Window Manager ---

  const openWindows = new Map(); // type -> { el, contentEl, type }
  let topZ = 1000;

  const WINDOW_TITLES = {
    projects: "Projects",
    photos: "Photos",
    text: "About.txt",
    calls: "Recent Calls",
    github: "GitHub",
    telegram: "Telegram",
    instagram: "Instagram",
    notes: "Notes",
    trash: "Trash",
    settings: "Settings",
  };

  function raiseWindow(win) {
    win.el.style.zIndex = ++topZ;
  }

  function makeDraggable(win) {
    const header = win.el.querySelector(".window-header");
    let dragging = false;
    let startX = 0,
      startY = 0,
      initialX = 0,
      initialY = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".window-control")) return;
      e.preventDefault();
      header.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.el.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      dragging = true;
    });

    header.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const margin = CONSTANTS.WINDOW_DRAG_MARGIN;
      const minX = margin - win.el.offsetWidth;
      const maxX = window.innerWidth - margin;
      const maxY = window.innerHeight - margin;
      win.el.style.left =
        Math.max(minX, Math.min(initialX + e.clientX - startX, maxX)) + "px";
      win.el.style.top =
        Math.max(0, Math.min(initialY + e.clientY - startY, maxY)) + "px";
    });

    const endDrag = () => {
      dragging = false;
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

  function makeResizable(win) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    let resizing = false;
    let dir = "";
    let startX = 0,
      startY = 0;
    let initialW = 0,
      initialH = 0,
      initialLeft = 0,
      initialTop = 0;

    win.el.querySelectorAll(".window-resize-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        dir = handle.dataset.dir;
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.el.getBoundingClientRect();
        initialW = rect.width;
        initialH = rect.height;
        initialLeft = rect.left;
        initialTop = rect.top;
        // С первого ресайза размер окна полностью контролирует JS.
        win.el.style.maxWidth = "none";
        win.el.style.maxHeight = "none";
      });

      handle.addEventListener("pointermove", (e) => {
        if (!resizing || !handle.hasPointerCapture(e.pointerId)) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const minW = CONSTANTS.WINDOW_MIN_WIDTH;
        const minH = CONSTANTS.WINDOW_MIN_HEIGHT;

        let w = initialW,
          h = initialH,
          left = initialLeft,
          top = initialTop;

        if (dir.includes("e")) {
          w = clamp(initialW + dx, minW, window.innerWidth - initialLeft);
        } else if (dir.includes("w")) {
          w = clamp(initialW - dx, minW, initialLeft + initialW);
          left = initialLeft + initialW - w;
        }
        if (dir.includes("s")) {
          h = clamp(initialH + dy, minH, window.innerHeight - initialTop);
        } else if (dir.includes("n")) {
          h = clamp(initialH - dy, minH, initialTop + initialH);
          top = initialTop + initialH - h;
        }

        win.el.style.width = w + "px";
        win.el.style.height = h + "px";
        win.el.style.left = left + "px";
        win.el.style.top = top + "px";
      });

      const endResize = () => {
        resizing = false;
        dir = "";
      };
      handle.addEventListener("pointerup", endResize);
      handle.addEventListener("pointercancel", endResize);
    });
  }

  function closeWindow(win) {
    if (win.el.classList.contains("is-closing")) return;
    win.el.classList.add("is-closing");
    const onEnd = (event) => {
      if (event.animationName !== "window-minimize") return;
      win.el.removeEventListener("animationend", onEnd);
      win.el.remove();
      openWindows.delete(win.type);
    };
    win.el.addEventListener("animationend", onEnd);
  }

  function createWindow(type) {
    const el = windowTemplate.content.firstElementChild.cloneNode(true);
    const contentEl = el.querySelector(".window-content");
    const win = { el, contentEl, type };
    const title = WINDOW_TITLES[type] || type;

    el.querySelector(".window-title").textContent = title;
    el.setAttribute("aria-label", title);

    el.addEventListener("pointerdown", () => raiseWindow(win));
    el.querySelector(".window-control.close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeWindow(win);
    });
    makeDraggable(win);
    makeResizable(win);

    document.body.appendChild(el);

    const step = CONSTANTS.WINDOW_CASCADE_STEP;
    const slot = openWindows.size % 6;
    let left = 60 + slot * step;
    let top = 60 + slot * step;
    left = Math.min(left, Math.max(20, window.innerWidth - el.offsetWidth - 20));
    top = Math.min(top, Math.max(20, window.innerHeight - el.offsetHeight - 20));
    el.style.left = left + "px";
    el.style.top = top + "px";

    openWindows.set(type, win);
    raiseWindow(win);
    return win;
  }

  function closeTopWindow() {
    let top = null;
    for (const win of openWindows.values()) {
      if (!top || Number(win.el.style.zIndex) >= Number(top.el.style.zIndex)) {
        top = win;
      }
    }
    if (top) closeWindow(top);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTopWindow();
  });

  // --- Open Window ---

  let projectsPromise = null;

  function loadProjects() {
    return (projectsPromise ??= fetch("projects/projects.json")
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then((data) => {
        folderContents.projects = data.map((item) => ({
          src: "projects/" + item.image,
          name: item.name,
          url: item.url ?? null,
        }));
        return folderContents.projects;
      }));
  }

  const WINDOW_RENDER_STRATEGIES = {
    photos: (contentEl, index) => renderFolderContent(contentEl, "photos", index),
    projects: (contentEl, index) => {
      contentEl.innerHTML =
        '<div class="text-content"><p>Loading...</p></div>';
      loadProjects()
        .then(() => renderFolderContent(contentEl, "projects", index))
        .catch(() => {
          contentEl.innerHTML =
            '<div class="folder-content"><p>Failed to load projects.</p></div>';
        });
    },
    trash: (contentEl, index) => renderFolderContent(contentEl, "trash", index),
    text: (contentEl) => renderTextFile(contentEl),
    calls: (contentEl) => renderCalls(contentEl),
    notes: (contentEl) => renderNotes(contentEl),
    github: (contentEl) => loadGitHubProfile(contentEl),
    telegram: (contentEl) => renderTelegram(contentEl),
    instagram: (contentEl) => renderPlaceholder(contentEl, "Instagram"),
    settings: (contentEl) => renderSettings(contentEl),
  };

  function openWindow(type, fileIndex) {
    if (!type) return;
    const render = WINDOW_RENDER_STRATEGIES[type];
    try {
      let win = openWindows.get(type);
      if (win) {
        win.el.classList.remove("is-closing");
        raiseWindow(win);
        if (Number.isInteger(fileIndex) && render) {
          render(win.contentEl, fileIndex);
        }
        return;
      }
      win = createWindow(type);
      if (render) {
        render(win.contentEl, fileIndex);
      } else {
        console.warn("No renderer for window type:", type);
        renderPlaceholder(win.contentEl, type);
      }
    } catch (error) {
      console.error("Error opening window:", type, error);
      const win = openWindows.get(type);
      if (win) {
        win.contentEl.innerHTML =
          '<div class="error-content"><p>Failed to open content.</p></div>';
      }
    }
  }

  // --- Rendering ---

  function renderPlaceholder(windowContent, name) {
    windowContent.innerHTML = `
            <div class="text-content">
                <h2>${escapeHtml(name)}</h2>
                <p>Coming soon.</p>
            </div>
        `;
  }

  function renderFolder(windowContent, type) {
    const items = folderContents[type] || [];
    if (!items.length) {
      windowContent.innerHTML =
        '<div class="folder-content"><p>This folder is empty.</p></div>';
      return;
    }

    windowContent.innerHTML = `
            <div class="folder-content">
                ${items
                  .map(
                    (item, index) => `
                    <div class="folder-item" data-index="${index}" data-type="${escapeHtml(type)}"
                         tabindex="0" role="button" aria-label="Open ${escapeHtml(item.name)}">
                        <img src="${escapeHtml(item.src)}" alt="">
                        <span>${escapeHtml(item.name)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;

    const handleSelection = (e) => {
      const item = e.target.closest(".folder-item");
      if (!item) return;
      const index = parseInt(item.dataset.index, 10);
      if (isNaN(index)) return;
      if (type === "projects") {
        const project = folderContents[type][index];
        if (project?.url)
          window.open(project.url, "_blank", "noopener,noreferrer");
      } else {
        openWindow(type, index);
      }
    };

    const folderContent = windowContent.querySelector(".folder-content");
    folderContent.addEventListener("click", handleSelection);
    folderContent.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      handleSelection(e);
    });
  }

  function renderFolderContent(windowContent, type, fileIndex) {
    const items = folderContents[type] || [];
    if (!items.length) {
      windowContent.innerHTML =
        '<div class="folder-content"><p>This folder is empty.</p></div>';
      return;
    }
    if (Number.isInteger(fileIndex) && items[fileIndex]) {
      renderGallery(windowContent, type, fileIndex);
    } else {
      renderFolder(windowContent, type);
    }
  }

  function renderTextFile(windowContent) {
    windowContent.innerHTML = `
            <div class="text-content">
                <h2>About</h2>
                <p>This is a desktop interface template.</p>
                <p>Built with vanilla JavaScript, HTML, and CSS.</p>
            </div>
        `;
  }

  function renderCalls(windowContent) {
    windowContent.innerHTML =
      '<div class="call-log"><p>No recent calls</p></div>';
  }

  function renderNotes(windowContent) {
    windowContent.innerHTML =
      '<textarea class="notes-area" placeholder="Your notes..." aria-label="Notes textarea"></textarea>';
  }

  function renderGallery(windowContent, type, startIndex) {
    startIndex = startIndex || 0;
    const items = folderContents[type] || [];
    if (!items.length) return;

    currentIndex[type] = startIndex;

    windowContent.innerHTML = `
            <div class="gallery" role="region" aria-label="Image gallery">
                <button class="arrow left" aria-label="Previous image">&#10094;</button>
                <div class="gallery-container">
                    ${items
                      .map(
                        (item, idx) => `
                        <div class="gallery-item${type === "projects" ? " gallery-item--link" : ""}"
                             data-index="${idx}" role="img" aria-label="${escapeHtml(item.name)}">
                            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.name)}">
                        </div>
                    `,
                      )
                      .join("")}
                </div>
                <button class="arrow right" aria-label="Next image">&#10095;</button>
            </div>
        `;

    const container = windowContent.querySelector(".gallery-container");
    const leftArrow = windowContent.querySelector(".arrow.left");
    const rightArrow = windowContent.querySelector(".arrow.right");

    const updateGallery = () => {
      container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;
      leftArrow.setAttribute("aria-disabled", String(currentIndex[type] === 0));
      rightArrow.setAttribute(
        "aria-disabled",
        String(currentIndex[type] === items.length - 1),
      );
    };

    leftArrow.addEventListener("click", () => {
      currentIndex[type] =
        (currentIndex[type] - 1 + items.length) % items.length;
      updateGallery();
    });

    rightArrow.addEventListener("click", () => {
      currentIndex[type] = (currentIndex[type] + 1) % items.length;
      updateGallery();
    });

    updateGallery();

    if (type === "projects") {
      windowContent.querySelector(".gallery").addEventListener("click", (e) => {
        const item = e.target.closest(".gallery-item--link");
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (!isNaN(idx) && items[idx]?.url) {
          window.open(items[idx].url, "_blank", "noopener,noreferrer");
        }
      });
    }
  }

  // --- GitHub ---

  function fetchGitHubData(username) {
    githubDataPromise ??= fetch("github-data.json").then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    return githubDataPromise.then((data) => {
      const profile = data[username];
      if (!profile?.user) throw new Error("Profile not found: " + username);
      return profile;
    });
  }

  function loadGitHubProfile(windowContent) {
    windowContent.innerHTML = `
            <div class="github-profile">
                <div class="gh-profiles">
                    ${GITHUB_PROFILES.map(renderGitHubProfileSection).join("")}
                </div>
            </div>
        `;
    GITHUB_PROFILES.forEach(hydrateGitHubProfile);
  }

  function renderGitHubProfileSection({ prefix, username }) {
    return `
            <section class="gh-profile" data-user="${username}">
                <div class="gh-body">
                    <div class="gh-left-column">
                        <img id="${prefix}-avatar" class="gh-avatar" src="" alt="Avatar ${username}">
                        <h2 id="${prefix}-name">Loading...</h2>
                        <p id="${prefix}-followers">Loading...</p>
                    </div>
                    <div class="gh-right-column">
                        <div class="gh-readme" id="${prefix}-readme">Loading README...</div>
                    </div>
                </div>
            </section>
        `;
  }

  function hydrateGitHubProfile({ username, prefix }) {
    const avatar    = document.getElementById(prefix + "-avatar");
    const nameEl    = document.getElementById(prefix + "-name");
    const followers = document.getElementById(prefix + "-followers");
    const readmeEl  = document.getElementById(prefix + "-readme");

    fetchGitHubData(username)
      .then(({ user, readme }) => {
        if (avatar && user) {
          avatar.src = user.avatar_url;
          avatar.alt = "Avatar " + user.login;
        }
        if (nameEl)
          nameEl.textContent = user ? user.name || user.login : "Failed to load";
        if (followers && user)
          followers.textContent = `${user.followers} followers · ${user.following} following`;

        if (readmeEl) {
          if (
            readme &&
            typeof DOMPurify !== "undefined" &&
            typeof marked !== "undefined"
          ) {
            readmeEl.innerHTML = DOMPurify.sanitize(marked.parse(readme));
          } else {
            readmeEl.textContent = readme || "No README found.";
          }
        }
      })
      .catch((error) => {
        if (nameEl)    nameEl.textContent    = "Failed to load";
        if (followers) followers.textContent = "";
        if (readmeEl)  readmeEl.textContent  = "No README found.";
        console.error("GitHub profile error:", error);
      });
  }

  // --- Telegram ---

  function renderTelegram(windowContent) {
    windowContent.innerHTML = `
            <div class="telegram-window">
                <div class="telegram-header">Telegram</div>
                <div class="telegram-body">
                    <div class="telegram-chat-list" id="telegram-chat-list" role="list" aria-label="Chat list"></div>
                    <div class="telegram-messages" id="telegram-messages" role="log" aria-label="Messages" aria-live="polite"></div>
                </div>
                <div class="telegram-input">
                    <input type="text" id="telegram-input" placeholder="Type a message..." aria-label="Message input">
                    <button id="telegram-send" aria-label="Send message">&#9658;</button>
                </div>
            </div>
        `;

    if (!telegramState.chats.length) {
      telegramState.chats.push({
        id: Date.now(),
        name: "New chat",
        avatar: "photos/photo1.jpg",
        messages: [],
      });
    }
    if (!telegramState.activeChatId)
      telegramState.activeChatId = telegramState.chats[0].id;

    const chatList = document.getElementById("telegram-chat-list");
    const messages = document.getElementById("telegram-messages");
    const input = document.getElementById("telegram-input");
    const sendBtn = document.getElementById("telegram-send");

    const findChat = (id) => telegramState.chats.find((c) => c.id === id);

    const renderChatList = () => {
      chatList.innerHTML = telegramState.chats
        .map(
          (chat) => `
                <div class="telegram-chat-item${chat.id === telegramState.activeChatId ? " is-active" : ""}"
                     data-id="${chat.id}" role="listitem" tabindex="0" aria-label="Chat with ${chat.name}">
                    <img src="${chat.avatar}" alt="">
                    <span>${chat.name}</span>
                </div>
            `,
        )
        .join("");
    };

    const renderMessages = () => {
      const chat = findChat(telegramState.activeChatId);
      if (!chat) return;
      messages.innerHTML = chat.messages
        .map(
          (msg) =>
            `<div class="telegram-message ${escapeHtml(msg.type)}" role="article">${escapeHtml(msg.text)}</div>`,
        )
        .join("");
      messages.scrollTop = messages.scrollHeight;
    };

    chatList.addEventListener("click", (e) => {
      const item = e.target.closest(".telegram-chat-item");
      if (!item) return;
      const nextId = parseInt(item.dataset.id, 10);
      if (isNaN(nextId)) return;
      telegramState.activeChatId = nextId;
      renderChatList();
      renderMessages();
    });

    chatList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".telegram-chat-item");
      if (!item) return;
      e.preventDefault();
      item.click();
    });

    const sendMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      const chat = findChat(telegramState.activeChatId);
      if (!chat) return;
      chat.messages.push({ type: "sent", text });
      input.value = "";
      renderMessages();
    };

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

    renderChatList();
    renderMessages();
  }

  // --- Cleanup ---

  window.addEventListener("beforeunload", () => {
    if (dateTimerId !== null) clearInterval(dateTimerId);
  });

  init();
});
