import { folderContents, openWindows } from "./state.js";
import { createWindow, raiseWindow } from "./window-manager.js";
import { renderFolderContent } from "./apps/folder.js";
import { loadGitHubProfile } from "./apps/github.js";
import { renderTelegram } from "./apps/telegram.js";
import {
  renderPlaceholder,
  renderTextFile,
  renderCalls,
  renderNotes,
} from "./apps/static-views.js";
import { renderSettings } from "./settings.js";

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

export function openWindow(type, fileIndex) {
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
