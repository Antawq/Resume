'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const CONSTANTS = {
        PADDING: 20,
        UPDATE_INTERVAL: 1000,
        DRAG_THRESHOLD: 5
    };

    // DOM elements
    const files        = document.querySelectorAll('.file');
    const windowEl     = document.getElementById('window');
    const windowContent = document.getElementById('window-content');
    const closeButton  = document.getElementById('close-window');
    const datetimeEl   = document.getElementById('datetime');

    const DATE_FORMATTERS = {
        menu: new Intl.DateTimeFormat('ru-RU', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        })
    };

    let dateTimerId = null;

    const folderContents = {
        photos: [
            { src: 'photos/photo1.png', name: 'Photo 1' },
            { src: 'photos/photo2.png', name: 'Photo 2' },
            { src: 'photos/photo3.png', name: 'Photo 3' }
        ],
        projects: [],
        trash: []
    };

    let currentIndex = { photos: 0, projects: 0, trash: 0 };

    const GITHUB_PROFILES = [
        { username: 'swid-yera', prefix: 'gh-main' },
        { username: 'Antawq',    prefix: 'gh-alt'  }
    ];

    let githubDataPromise = null;

    const isLocalStorageAvailable = (() => {
        try {
            const k = '__gh_cache_test__';
            localStorage.setItem(k, '1');
            localStorage.removeItem(k);
            return true;
        } catch (e) {
            console.warn('LocalStorage недоступен.', e);
            return false;
        }
    })();

    const telegramState = {
        chats: [
            { id: 1, name: 'Alice', avatar: 'photos/photo1.jpg', messages: [{ type: 'received', text: 'Hi there!' }] },
            { id: 2, name: 'Bob',   avatar: 'photos/photo2.jpg', messages: [{ type: 'received', text: 'Hello!'    }] }
        ],
        activeChatId: 1
    };

    const THEME_PRESETS = [
        { id: 'neon',     label: 'Neon',   accent: '#00DDEB', purple: '#BB86FC', green: '#03DAC6', swatch: '#00DDEB' },
        { id: 'rose',     label: 'Rosé',   accent: '#F4A0B5', purple: '#D4A0E0', green: '#F0C0A0', swatch: '#F4A0B5' },
        { id: 'forest',   label: 'Forest', accent: '#4CAF50', purple: '#81C784', green: '#A5D6A7', swatch: '#4CAF50' },
        { id: 'amber',    label: 'Amber',  accent: '#FFB300', purple: '#FFD54F', green: '#FFCA28', swatch: '#FFB300' },
        { id: 'mono',     label: 'Mono',   accent: '#AAAAAA', purple: '#888888', green: '#CCCCCC', swatch: '#AAAAAA' }
    ];

    const SETTINGS_KEY = 'desktop-settings';

    // --- Utilities ---

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function loadSettings() {
        if (!isLocalStorageAvailable) return { brightness: 0, theme: 'neon' };
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { brightness: 0, theme: 'neon' };
    }

    function saveSettings(settings) {
        if (!isLocalStorageAvailable) return;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    function applyBrightness(value) {
        const overlay = document.getElementById('brightness-overlay');
        if (!overlay) return;
        overlay.style.opacity = value / 100;
    }

    function applyTheme(themeId) {
        const theme = THEME_PRESETS.find(t => t.id === themeId);
        if (!theme) return;
        const root = document.documentElement;
        root.style.setProperty('--neon-blue',   theme.accent);
        root.style.setProperty('--neon-purple',  theme.purple);
        root.style.setProperty('--neon-green',   theme.green);
    }

    let currentSettings = loadSettings();

    // --- Init ---

    function init() {
        applyBrightness(currentSettings.brightness);
        applyTheme(currentSettings.theme);
        setupDateTime();
        setupFileDragging();
        setupDockItems();
        setupWindowDragging();
        setupWindowClosing();
    }

    // --- DateTime ---

    function updateDateTime() {
        try {
            if (datetimeEl) datetimeEl.textContent = DATE_FORMATTERS.menu.format(new Date()).replace(',', '');
        } catch (e) {
            console.error('Error updating datetime:', e);
        }
    }

    function setupDateTime() {
        updateDateTime();
        if (dateTimerId === null) {
            dateTimerId = window.setInterval(updateDateTime, CONSTANTS.UPDATE_INTERVAL);
        }
    }

    // --- Settings ---

    function renderSettings() {
        windowContent.innerHTML = `
            <div class="settings-window">
                <div class="settings-section">
                    <label class="settings-label" for="brightness-slider">Brightness</label>
                    <input type="range" id="brightness-slider" class="settings-slider" min="0" max="70" value="${currentSettings.brightness}">
                </div>
                <div class="settings-section">
                    <span class="settings-label">Theme</span>
                    <div class="settings-swatches" id="theme-swatches">
                        ${THEME_PRESETS.map(t => `
                            <button class="settings-swatch${t.id === currentSettings.theme ? ' is-active' : ''}"
                                    data-id="${t.id}" style="background:${t.swatch}"
                                    aria-label="${escapeHtml(t.label)}"></button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        windowContent.querySelector('#brightness-slider').addEventListener('input', function () {
            currentSettings.brightness = parseInt(this.value, 10);
            applyBrightness(currentSettings.brightness);
            saveSettings(currentSettings);
        });

        windowContent.querySelector('#theme-swatches').addEventListener('click', e => {
            const swatch = e.target.closest('.settings-swatch');
            if (!swatch) return;
            currentSettings.theme = swatch.dataset.id;
            applyTheme(currentSettings.theme);
            windowContent.querySelectorAll('#theme-swatches .settings-swatch').forEach(s => s.classList.remove('is-active'));
            swatch.classList.add('is-active');
            saveSettings(currentSettings);
        });
    }

    // --- File Dragging — Pointer Events ---

    function setupFileDragging() {
        files.forEach(file => {
            let isDragging = false;
            let hasMoved   = false;
            let opening    = false;
            let offsetX = 0, offsetY = 0;
            let startX  = 0, startY  = 0;

            file.addEventListener('pointerdown', e => {
                e.preventDefault();
                file.setPointerCapture(e.pointerId);
                isDragging = false;
                hasMoved   = false;
                startX = e.clientX;
                startY = e.clientY;
                const rect = file.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
            });

            file.addEventListener('pointermove', e => {
                if (!file.hasPointerCapture(e.pointerId)) return;

                const dx = Math.abs(e.clientX - startX);
                const dy = Math.abs(e.clientY - startY);

                if (!isDragging && (dx > CONSTANTS.DRAG_THRESHOLD || dy > CONSTANTS.DRAG_THRESHOLD)) {
                    isDragging = true;
                    file.classList.add('dragging');
                }
                if (!isDragging) return;

                hasMoved = true;
                const maxX = window.innerWidth  - file.offsetWidth  - CONSTANTS.PADDING;
                const maxY = window.innerHeight - file.offsetHeight - CONSTANTS.PADDING - 80;
                const minY = CONSTANTS.PADDING + 50;

                file.style.left = Math.max(CONSTANTS.PADDING, Math.min(e.clientX - offsetX, maxX)) + 'px';
                file.style.top  = Math.max(minY,              Math.min(e.clientY - offsetY, maxY)) + 'px';
            });

            file.addEventListener('pointerup', () => {
                if (!hasMoved && !opening) {
                    opening = true;
                    openWindow(file.dataset.type);
                    setTimeout(() => { opening = false; }, 100);
                }
                if (isDragging) file.classList.remove('dragging');
                isDragging = false;
                hasMoved   = false;
            });

            file.addEventListener('pointercancel', () => {
                if (isDragging) file.classList.remove('dragging');
                isDragging = false;
                hasMoved   = false;
            });

            file.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openWindow(file.dataset.type);
                }
            });
        });
    }

    // --- Dock Items ---

    function setupDockItems() {
        document.querySelectorAll('.dock-item').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                openWindow(item.dataset.type);
            });
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openWindow(item.dataset.type);
                }
            });
        });
    }

    // --- Window Dragging — Pointer Events ---

    function setupWindowDragging() {
        const header = windowEl.querySelector('.window-header');
        let isDragging = false;
        let startX = 0, startY = 0, initialX = 0, initialY = 0;

        header.addEventListener('pointerdown', e => {
            if (!windowEl.classList.contains('is-visible')) return;
            if (e.target.closest('.window-control')) return;
            e.preventDefault();
            header.setPointerCapture(e.pointerId);

            startX = e.clientX;
            startY = e.clientY;
            const rect = windowEl.getBoundingClientRect();
            windowEl.classList.add('is-dragging');
            windowEl.style.left = rect.left + 'px';
            windowEl.style.top  = rect.top  + 'px';
            initialX = rect.left;
            initialY = rect.top;
            isDragging = true;
        });

        header.addEventListener('pointermove', e => {
            if (!isDragging) return;
            e.preventDefault();
            const maxX = window.innerWidth  - windowEl.offsetWidth;
            const maxY = window.innerHeight - windowEl.offsetHeight;
            windowEl.style.left = Math.max(0, Math.min(initialX + e.clientX - startX, Math.max(0, maxX))) + 'px';
            windowEl.style.top  = Math.max(0, Math.min(initialY + e.clientY - startY, Math.max(0, maxY))) + 'px';
        });

        header.addEventListener('pointerup',     () => { isDragging = false; });
        header.addEventListener('pointercancel', () => { isDragging = false; });
    }

    // --- Window Closing ---

    function setupWindowClosing() {
        let closingAnimationHandler = null;

        const resetWindowPosition = () => {
            windowEl.classList.remove('is-dragging');
            windowEl.style.left = '';
            windowEl.style.top  = '';
        };

        const closeWindow = () => {
            if (!windowEl.classList.contains('is-visible') || windowEl.classList.contains('is-closing')) return;

            if (closingAnimationHandler) {
                windowEl.removeEventListener('animationend', closingAnimationHandler);
                closingAnimationHandler = null;
            }

            windowEl.classList.add('is-closing');

            closingAnimationHandler = event => {
                if (event.animationName !== 'window-minimize') return;
                windowEl.classList.remove('is-visible', 'is-closing');
                windowContent.innerHTML = '';
                resetWindowPosition();
                windowEl.removeEventListener('animationend', closingAnimationHandler);
                closingAnimationHandler = null;
            };

            windowEl.addEventListener('animationend', closingAnimationHandler);
        };

        closeButton.addEventListener('click', e => {
            e.stopPropagation();
            closeWindow();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && windowEl.classList.contains('is-visible')) {
                closeWindow();
            }
        });
    }

    // --- Open Window ---

    let projectsPromise = null;

    function loadProjects() {
        return projectsPromise ??= fetch('projects/projects.json')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(data => {
                folderContents.projects = data.map(item => ({
                    src: 'projects/' + item.image,
                    name: item.name,
                    url: item.url ?? null
                }));
                return folderContents.projects;
            });
    }

    const WINDOW_RENDER_STRATEGIES = {
        photos:    index => renderFolderContent('photos',   index),
        projects:  index => {
            windowContent.innerHTML = '<div class="text-content"><p>Loading...</p></div>';
            loadProjects()
                .then(() => renderFolderContent('projects', index))
                .catch(() => { windowContent.innerHTML = '<div class="folder-content"><p>Не удалось загрузить проекты.</p></div>'; });
        },
        trash:     index => renderFolderContent('trash',    index),
        text:      ()    => renderTextFile(),
        calls:     ()    => renderCalls(),
        notes:     ()    => renderNotes(),
        github:    ()    => loadGitHubProfile(),
        telegram:  ()    => renderTelegram(),
        instagram: ()    => renderPlaceholder('Instagram'),
        settings:  ()    => renderSettings()
    };

    function openWindow(type, fileIndex) {
        if (!type) return;
        try {
            const wasHidden = !windowEl.classList.contains('is-visible');
            if (wasHidden) {
                windowEl.classList.remove('is-dragging');
                windowEl.style.left = '';
                windowEl.style.top  = '';
            }
            windowEl.classList.remove('is-closing');
            windowEl.classList.add('is-visible');
            windowContent.innerHTML = '';

            const render = WINDOW_RENDER_STRATEGIES[type];
            if (render) {
                render(fileIndex);
            } else {
                console.warn('No renderer for window type:', type);
                renderPlaceholder(type);
            }
        } catch (error) {
            console.error('Error opening window:', type, error);
            windowContent.innerHTML = '<div class="error-content"><p>Не удалось открыть содержимое.</p></div>';
        }
    }

    // --- Rendering ---

    function renderPlaceholder(name) {
        windowContent.innerHTML = `
            <div class="text-content">
                <h2>${escapeHtml(name)}</h2>
                <p>Содержимое в разработке.</p>
            </div>
        `;
    }

    function renderFolder(type) {
        const items = folderContents[type] || [];
        if (!items.length) {
            windowContent.innerHTML = '<div class="folder-content"><p>Папка пока пуста.</p></div>';
            return;
        }

        windowContent.innerHTML = `
            <div class="folder-content">
                ${items.map((item, index) => `
                    <div class="folder-item" data-index="${index}" data-type="${escapeHtml(type)}"
                         tabindex="0" role="button" aria-label="Open ${escapeHtml(item.name)}">
                        <img src="${escapeHtml(item.src)}" alt="">
                        <span>${escapeHtml(item.name)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        const handleSelection = e => {
            const item = e.target.closest('.folder-item');
            if (!item) return;
            const index = parseInt(item.dataset.index, 10);
            if (isNaN(index)) return;
            if (type === 'projects') {
                const project = folderContents[type][index];
                if (project?.url) window.open(project.url, '_blank', 'noopener,noreferrer');
            } else {
                openWindow(type, index);
            }
        };

        const folderContent = windowContent.querySelector('.folder-content');
        folderContent.addEventListener('click', handleSelection);
        folderContent.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            handleSelection(e);
        });
    }

    function renderFolderContent(type, fileIndex) {
        const items = folderContents[type] || [];
        if (!items.length) {
            windowContent.innerHTML = '<div class="folder-content"><p>Папка пока пуста.</p></div>';
            return;
        }
        if (Number.isInteger(fileIndex) && items[fileIndex]) {
            renderGallery(type, fileIndex);
        } else {
            renderFolder(type);
        }
    }

    function renderTextFile() {
        windowContent.innerHTML = `
            <div class="text-content">
                <h2>About</h2>
                <p>This is a desktop interface template.</p>
                <p>Built with vanilla JavaScript, HTML, and CSS.</p>
            </div>
        `;
    }

    function renderCalls() {
        windowContent.innerHTML = '<div class="call-log"><p>No recent calls</p></div>';
    }

    function renderNotes() {
        windowContent.innerHTML = '<textarea class="notes-area" placeholder="Your notes..." aria-label="Notes textarea"></textarea>';
    }

    function renderGallery(type, startIndex) {
        startIndex = startIndex || 0;
        const items = folderContents[type] || [];
        if (!items.length) return;

        currentIndex[type] = startIndex;

        windowContent.innerHTML = `
            <div class="gallery" role="region" aria-label="Image gallery">
                <button class="arrow left" aria-label="Previous image">&#10094;</button>
                <div class="gallery-container">
                    ${items.map((item, idx) => `
                        <div class="gallery-item${type === 'projects' ? ' gallery-item--link' : ''}"
                             data-index="${idx}" role="img" aria-label="${escapeHtml(item.name)}">
                            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.name)}">
                        </div>
                    `).join('')}
                </div>
                <button class="arrow right" aria-label="Next image">&#10095;</button>
            </div>
        `;

        const container  = windowContent.querySelector('.gallery-container');
        const leftArrow  = windowContent.querySelector('.arrow.left');
        const rightArrow = windowContent.querySelector('.arrow.right');

        const updateGallery = () => {
            container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;
            leftArrow.setAttribute('aria-disabled',  String(currentIndex[type] === 0));
            rightArrow.setAttribute('aria-disabled', String(currentIndex[type] === items.length - 1));
        };

        leftArrow.addEventListener('click', () => {
            currentIndex[type] = (currentIndex[type] - 1 + items.length) % items.length;
            updateGallery();
        });

        rightArrow.addEventListener('click', () => {
            currentIndex[type] = (currentIndex[type] + 1) % items.length;
            updateGallery();
        });

        updateGallery();

        if (type === 'projects') {
            windowContent.querySelector('.gallery').addEventListener('click', e => {
                const item = e.target.closest('.gallery-item--link');
                if (!item) return;
                const idx = parseInt(item.dataset.index, 10);
                if (!isNaN(idx) && items[idx]?.url) {
                    window.open(items[idx].url, '_blank', 'noopener,noreferrer');
                }
            });
        }
    }

    // --- GitHub ---

    function fetchGitHubData(username) {
        githubDataPromise ??= fetch('github-data.json')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
        return githubDataPromise.then(data => {
            const profile = data[username];
            if (!profile?.user) throw new Error('Profile not found: ' + username);
            return profile;
        });
    }

    function loadGitHubProfile() {
        windowContent.innerHTML = `
            <div class="github-profile">
                <div class="gh-profiles">
                    ${GITHUB_PROFILES.map(renderGitHubProfileSection).join('')}
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
                        <div class="gh-repos">
                            <h3>Popular repositories</h3>
                            <ul id="${prefix}-repos"></ul>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function hydrateGitHubProfile({ username, prefix }) {
        const avatar    = document.getElementById(prefix + '-avatar');
        const nameEl    = document.getElementById(prefix + '-name');
        const followers = document.getElementById(prefix + '-followers');
        const reposList = document.getElementById(prefix + '-repos');
        const readmeEl  = document.getElementById(prefix + '-readme');

        fetchGitHubData(username)
            .then(({ user, repos, readme }) => {
                if (avatar && user) { avatar.src = user.avatar_url; avatar.alt = 'Avatar ' + user.login; }
                if (nameEl)      nameEl.textContent      = user ? (user.name || user.login) : 'Failed to load';
                if (followers && user) followers.textContent = `${user.followers} followers · ${user.following} following`;

                if (reposList) {
                    if (repos?.length) {
                        reposList.innerHTML = repos.map(repo => `
                            <li>
                                <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a>
                                ⭐ ${escapeHtml(String(repo.stargazers_count))}
                            </li>
                        `).join('');
                    } else {
                        reposList.textContent = 'No public repositories.';
                    }
                }

                if (readmeEl) {
                    if (readme && typeof DOMPurify !== 'undefined' && typeof marked !== 'undefined') {
                        readmeEl.innerHTML = DOMPurify.sanitize(marked.parse(readme));
                    } else {
                        readmeEl.textContent = readme || 'No README found.';
                    }
                }
            })
            .catch(error => {
                const isRateLimit = Boolean(error?.isRateLimit);
                if (nameEl)      nameEl.textContent      = isRateLimit ? 'Лимит GitHub API' : 'Failed to load';
                if (followers)   followers.textContent   = '';
                if (reposList) {
                    if (isRateLimit) {
                        reposList.innerHTML = `<li><span>${GITHUB_RATE_LIMIT_MESSAGE}</span><br>
                            <a href="https://github.com/${escapeHtml(username)}" target="_blank" rel="noopener noreferrer">Открыть профиль ${escapeHtml(username)}</a></li>`;
                    } else {
                        reposList.textContent = 'Failed to load repos.';
                    }
                }
                if (readmeEl) readmeEl.textContent = isRateLimit ? GITHUB_RATE_LIMIT_MESSAGE : 'No README found.';
                console.error('GitHub profile error:', error);
            });
    }

    function refreshGitHubData(username) {
        return Promise.all([
            fetchGitHubUser(username),
            fetchGitHubRepos(username).catch(e => { if (e?.isRateLimit) throw e; return []; }),
            fetchUserReadme(username).catch(e  => { if (e?.isRateLimit) throw e; return null; })
        ])
        .then(([user, repos, readme]) => {
            const payload = { user, repos, readme };
            writeGitHubCache(username, payload);
            return payload;
        })
        .catch(error => {
            githubPromises.delete(username);
            throw error;
        });
    }

    async function fetchGitHubResource(url, options = {}) {
        const responseType = options.responseType || 'json';
        try {
            const response = await fetch(url, { headers: GITHUB_REQUEST_HEADERS });
            if (response.status === 403) {
                let message = 'GitHub API rate limit exceeded';
                try { const body = await response.json(); if (body?.message) message = body.message; } catch (e) {}
                const err = new Error(message);
                err.isRateLimit = true;
                err.status = 403;
                throw err;
            }
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                const err = new Error(text || response.statusText);
                err.status = response.status;
                throw err;
            }
            return responseType === 'text' ? response.text() : response.json();
        } catch (error) {
            if (error.isRateLimit) throw error;
            console.error('GitHub fetch error:', url, error);
            throw error;
        }
    }

    const fetchGitHubUser  = username => fetchGitHubResource(`https://api.github.com/users/${username}`);
    const fetchGitHubRepos = username => fetchGitHubResource(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`)
        .then(repos => { if (!Array.isArray(repos)) throw new Error('Invalid repos'); return repos; });

    async function fetchUserReadme(username) {
        const paths = [
            `https://raw.githubusercontent.com/${username}/${username}/main/README.md`,
            `https://raw.githubusercontent.com/${username}/${username}/master/README.md`,
            `https://raw.githubusercontent.com/${username}/profile/main/README.md`
        ];
        for (const path of paths) {
            try {
                const res = await fetch(path);
                if (res.status === 403) { const e = new Error('rate limit'); e.isRateLimit = true; throw e; }
                if (res.ok) return res.text();
            } catch (e) {
                if (e.isRateLimit) throw e;
            }
        }
        throw new Error('README not found');
    }

    // --- Telegram ---

    function renderTelegram() {
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
            telegramState.chats.push({ id: Date.now(), name: 'New chat', avatar: 'photos/photo1.jpg', messages: [] });
        }
        if (!telegramState.activeChatId) telegramState.activeChatId = telegramState.chats[0].id;

        const chatList = document.getElementById('telegram-chat-list');
        const messages = document.getElementById('telegram-messages');
        const input    = document.getElementById('telegram-input');
        const sendBtn  = document.getElementById('telegram-send');

        const findChat = id => telegramState.chats.find(c => c.id === id);

        const renderChatList = () => {
            chatList.innerHTML = telegramState.chats.map(chat => `
                <div class="telegram-chat-item${chat.id === telegramState.activeChatId ? ' is-active' : ''}"
                     data-id="${chat.id}" role="listitem" tabindex="0" aria-label="Chat with ${chat.name}">
                    <img src="${chat.avatar}" alt="">
                    <span>${chat.name}</span>
                </div>
            `).join('');
        };

        const renderMessages = () => {
            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;
            messages.innerHTML = chat.messages.map(msg =>
                `<div class="telegram-message ${escapeHtml(msg.type)}" role="article">${escapeHtml(msg.text)}</div>`
            ).join('');
            messages.scrollTop = messages.scrollHeight;
        };

        chatList.addEventListener('click', e => {
            const item = e.target.closest('.telegram-chat-item');
            if (!item) return;
            const nextId = parseInt(item.dataset.id, 10);
            if (isNaN(nextId)) return;
            telegramState.activeChatId = nextId;
            renderChatList();
            renderMessages();
        });

        chatList.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const item = e.target.closest('.telegram-chat-item');
            if (!item) return;
            e.preventDefault();
            item.click();
        });

        const sendMessage = () => {
            const text = input.value.trim();
            if (!text) return;
            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;
            chat.messages.push({ type: 'sent', text });
            input.value = '';
            renderMessages();
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

        renderChatList();
        renderMessages();
    }

    // --- Cleanup ---

    window.addEventListener('beforeunload', () => {
        if (dateTimerId !== null) clearInterval(dateTimerId);
    });

    init();
});
