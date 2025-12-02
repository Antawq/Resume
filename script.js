// script.js - jQuery version
$(document).ready(function() {
    const CONSTANTS = {
        PADDING: 20,
        UPDATE_INTERVAL: 1000,
        GITHUB_CACHE_TTL: 1000 * 60 * 30,
        GITHUB_CACHE_PREFIX: 'github-profile-cache:',
        ANIMATION_DEBOUNCE: 100,
        DRAG_THRESHOLD: 5
    };

    const $files = $('.file');
    const $windowElement = $('#window');
    const $windowContent = $('#window-content');
    const $closeButton = $('#close-window');
    const $datetimeElement = $('#datetime');
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const DATE_FORMATTERS = {
        menu: new Intl.DateTimeFormat('ru-RU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    };

    let dateTimerId = null;

    const folderContents = {
        photos: [
            { src: 'photos/photo1.png', name: 'Photo 1' },
            { src: 'photos/photo2.png', name: 'Photo 2' },
            { src: 'photos/photo3.png', name: 'Photo 3' }
        ],
        projects: [
            { src: 'projects/project1.png', name: 'Project 1', url: 'https://example.com/project1' },
            { src: 'projects/project2.png', name: 'Project 2', url: 'https://example.com/project2' }
        ],
        trash: [
            { src: 'trash/item1.png', name: 'Deleted 1' },
            { src: 'trash/item2.png', name: 'Deleted 2' }
        ]
    };

    let currentIndex = { photos: 0, projects: 0, trash: 0 };

    const GITHUB_PROFILES = [
        { username: "swid-yera", prefix: "gh-main" },
        { username: "Antawq", prefix: "gh-alt" }
    ];

    const GITHUB_RATE_LIMIT_MESSAGE = 'Превышен лимит GitHub API. Попробуйте снова через несколько минут или откройте профиль напрямую.';

    const telegramState = {
        chats: [
            { id: 1, name: 'Alice', avatar: 'photos/photo1.jpg', messages: [{ type: 'received', text: 'Hi there!' }] },
            { id: 2, name: 'Bob', avatar: 'photos/photo2.jpg', messages: [{ type: 'received', text: 'Hello!' }] }
        ],
        activeChatId: 1
    };

    const GITHUB_REQUEST_HEADERS = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };

    const githubDataCache = {};

    const isLocalStorageAvailable = (function() {
        try {
            const testKey = '__gh_cache_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('LocalStorage недоступен, кэш GitHub отключен.', error);
            return false;
        }
    })();

    // Initialize app
    function init() {
        setupDateTime();
        setupCheckButton();
        setupFileDragging();
        setupDockItems();
        setupWindowDragging();
        setupWindowClosing();
    }

    // Date and time
    function updateDateTime() {
        try {
            const now = new Date();
            if ($datetimeElement.length) {
                $datetimeElement.text(DATE_FORMATTERS.menu.format(now).replace(',', ''));
            }
        } catch (error) {
            console.error('Error updating datetime:', error);
        }
    }

    function setupDateTime() {
        updateDateTime();
        if (dateTimerId === null) {
            dateTimerId = window.setInterval(updateDateTime, CONSTANTS.UPDATE_INTERVAL);
        }
    }

    // Check button functionality
    function setupCheckButton() {
        const $checkButton = $('#check-button');
        const $checkPanel = $('#check-panel');

        if (!$checkButton.length || !$checkPanel.length) return;

        const toggleCheckPanel = function(forceState) {
            const shouldOpen = typeof forceState === 'boolean'
                ? forceState
                : !$checkPanel.hasClass('is-open');

            $checkPanel.toggleClass('is-open', shouldOpen);
            $checkPanel.attr('aria-hidden', !shouldOpen);
            $checkButton.attr('aria-expanded', shouldOpen);
        };

        $checkButton.on('click', function(e) {
            e.stopPropagation();
            toggleCheckPanel();
        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('.corner-area').length && !$(e.target).closest('.check-panel').length) {
                toggleCheckPanel(false);
            }
        });

        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                toggleCheckPanel(false);
            }
        });
    }

    // File dragging and keyboard navigation
    function setupFileDragging() {
        $files.each(function() {
            const $file = $(this);
            let isDragging = false;
            let offsetX = 0;
            let offsetY = 0;
            let hasMoved = false;
            let startTarget = null;
            let isProcessing = false;
            let startX = 0;
            let startY = 0;

            const attemptOpenWindow = function() {
                const type = $file.data('type');
                if (isProcessing || !type) return;
                isProcessing = true;
                openWindow(type);
                setTimeout(function() {
                    isProcessing = false;
                }, CONSTANTS.ANIMATION_DEBOUNCE);
            };

            const startDrag = function(e) {
                if (isMobile && !$(e.target).closest('.file-icon').length) return;

                e.preventDefault();
                startTarget = $file[0];
                isDragging = false;
                hasMoved = false;

                const rect = $file[0].getBoundingClientRect();
                const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

                startX = clientX;
                startY = clientY;
                offsetX = clientX - rect.left;
                offsetY = clientY - rect.top;
            };

            const moveDrag = function(e) {
                if (!startTarget) return;

                e.preventDefault();

                const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

                const deltaX = Math.abs(clientX - startX);
                const deltaY = Math.abs(clientY - startY);

                if (!isDragging && (deltaX > CONSTANTS.DRAG_THRESHOLD || deltaY > CONSTANTS.DRAG_THRESHOLD)) {
                    isDragging = true;
                    $file.addClass('dragging');
                }

                if (!isDragging) return;

                hasMoved = true;

                let newX = clientX - offsetX;
                let newY = clientY - offsetY;

                const maxX = $(window).width() - $file.outerWidth() - CONSTANTS.PADDING;
                const maxY = $(window).height() - $file.outerHeight() - CONSTANTS.PADDING - (isMobile ? 100 : 80);
                const minY = CONSTANTS.PADDING + (isMobile ? 40 : 50);

                newX = Math.max(CONSTANTS.PADDING, Math.min(newX, maxX));
                newY = Math.max(minY, Math.min(newY, maxY));

                $file.css({
                    left: newX + 'px',
                    top: newY + 'px'
                });
            };

            const endDrag = function(e) {
                if (isDragging) {
                    isDragging = false;
                    $file.removeClass('dragging');
                }

                if (!hasMoved && startTarget && startTarget === $file[0]) {
                    attemptOpenWindow();
                }

                startTarget = null;
            };

            if (isMobile) {
                $file.on('touchstart', startDrag);
                $file.on('touchmove', moveDrag);
                $file.on('touchend', endDrag);
                $file.on('touchcancel', endDrag);
            } else {
                $file.on('mousedown', function(e) {
                    startDrag(e);

                    const moveHandler = function(ev) {
                        moveDrag(ev);
                    };

                    const upHandler = function(ev) {
                        endDrag(ev);
                        $(document).off('mousemove', moveHandler);
                        $(document).off('mouseup', upHandler);
                    };

                    $(document).on('mousemove', moveHandler);
                    $(document).on('mouseup', upHandler);
                });
            }

            // Keyboard navigation
            $file.on('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    attemptOpenWindow();
                }
            });
        });
    }

    // Dock items
    function setupDockItems() {
        const $dockItems = $('.dock-item');
        $dockItems.each(function() {
            const $item = $(this);
            const eventType = isMobile ? 'touchend' : 'click';

            $item.on(eventType, function(e) {
                e.stopPropagation();
                openWindow($item.data('type'));
            });

            // Keyboard navigation
            $item.on('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openWindow($item.data('type'));
                }
            });
        });
    }

    // Window dragging
    function setupWindowDragging() {
        let isDraggingWindow = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        const $windowHeader = $windowElement.find('.window-header');

        const startDragWindow = function(e) {
            if (!$windowElement.hasClass('is-visible')) return;
            if ($(e.target).closest('.window-control').length) return;

            e.preventDefault();

            const touchEvent = e.type.includes('touch');
            startX = touchEvent ? e.touches[0].clientX : e.clientX;
            startY = touchEvent ? e.touches[0].clientY : e.clientY;

            const rect = $windowElement[0].getBoundingClientRect();
            $windowElement.addClass('is-dragging');
            $windowElement.css({
                left: rect.left + 'px',
                top: rect.top + 'px'
            });

            initialX = rect.left;
            initialY = rect.top;
            isDraggingWindow = true;
        };

        const moveDragWindow = function(e) {
            if (!isDraggingWindow) return;
            e.preventDefault();

            const touchEvent = e.type.includes('touch');
            const clientX = touchEvent ? e.touches[0].clientX : e.clientX;
            const clientY = touchEvent ? e.touches[0].clientY : e.clientY;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            const maxX = $(window).width() - $windowElement.outerWidth();
            const maxY = $(window).height() - $windowElement.outerHeight();

            const newX = Math.max(0, Math.min(initialX + deltaX, Math.max(0, maxX)));
            const newY = Math.max(0, Math.min(initialY + deltaY, Math.max(0, maxY)));

            $windowElement.css({
                left: newX + 'px',
                top: newY + 'px'
            });
        };

        const endDragWindow = function() {
            isDraggingWindow = false;
        };

        $windowHeader.on('mousedown', startDragWindow);
        $windowHeader.on('touchstart', startDragWindow);
        $(document).on('mousemove', moveDragWindow);
        $(document).on('touchmove', moveDragWindow);
        $(document).on('mouseup', endDragWindow);
        $(document).on('touchend', endDragWindow);
    }

    // Window closing
    function setupWindowClosing() {
        let closingAnimationHandler = null;

        const resetWindowPosition = function() {
            $windowElement.removeClass('is-dragging');
            $windowElement.css({
                left: '',
                top: ''
            });
        };

        const closeWindow = function() {
            if (!$windowElement.hasClass('is-visible') || $windowElement.hasClass('is-closing')) {
                return;
            }

            if (closingAnimationHandler) {
                $windowElement.off('animationend', closingAnimationHandler);
                closingAnimationHandler = null;
            }

            $windowElement.addClass('is-closing');

            closingAnimationHandler = function(event) {
                if (event.originalEvent.animationName !== 'window-minimize') return;

                $windowElement.removeClass('is-visible is-closing');
                $windowContent.html('');
                resetWindowPosition();

                $windowElement.off('animationend', closingAnimationHandler);
                closingAnimationHandler = null;
            };

            $windowElement.on('animationend', closingAnimationHandler);
        };

        $closeButton.on(isMobile ? 'touchend' : 'click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            closeWindow();
        });

        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && $windowElement.hasClass('is-visible')) {
                closeWindow();
            }
        });
    }

    // Open window
    const createFolderRenderer = function(type) {
        return function(index) {
            return renderFolderContent(type, index);
        };
    };

    const WINDOW_RENDER_STRATEGIES = {
        photos: createFolderRenderer('photos'),
        projects: createFolderRenderer('projects'),
        trash: createFolderRenderer('trash'),
        text: function() { return renderTextFile(); },
        calls: function() { return renderCalls(); },
        notes: function() { return renderNotes(); },
        github: function() { return loadGitHubProfile(); },
        telegram: function() { return renderTelegram(); },
        instagram: function() { return renderPlaceholder('Instagram'); }
    };

    function openWindow(type, fileIndex) {
        if (!type) return;

        try {
            const wasHidden = !$windowElement.hasClass('is-visible');

            if (wasHidden) {
                $windowElement.removeClass('is-dragging');
                $windowElement.css({
                    left: '',
                    top: ''
                });
            }

            $windowElement.removeClass('is-closing');
            $windowElement.addClass('is-visible');
            $windowContent.html('');

            const render = WINDOW_RENDER_STRATEGIES[type];

            if (render) {
                render(fileIndex);
            } else {
                console.warn('No renderer configured for window type: ' + type);
                renderPlaceholder(type);
            }
        } catch (error) {
            console.error('Error opening window: ' + type, error);
            $windowContent.html('<div class="error-content"><p>Не удалось открыть содержимое.</p></div>');
        }
    }

    // Rendering functions
    function renderPlaceholder(name) {
        $windowContent.html(`
            <div class="text-content">
                <h2>${name}</h2>
                <p>Содержимое в разработке.</p>
            </div>
        `);
    }

    function renderFolder(type) {
        const items = folderContents[type] || [];
        if (!items.length) {
            $windowContent.html(`
                <div class="folder-content">
                    <p>Папка пока пуста.</p>
                </div>
            `);
            return;
        }

        $windowContent.html(`
            <div class="folder-content">
                ${items.map((item, index) => `
                    <div class="folder-item" data-index="${index}" data-type="${type}" tabindex="0" role="button" aria-label="Open ${item.name}">
                        <img src="${item.src}" alt="">
                        <span>${item.name}</span>
                    </div>
                `).join('')}
            </div>
        `);

        const $folderItems = $windowContent.find('.folder-item');
        const selectEvent = isMobile ? 'touchend' : 'click';

        $folderItems.each(function() {
            const $item = $(this);

            const handleSelection = function(e) {
                e.stopPropagation();
                e.preventDefault();

                const index = parseInt($item.data('index'), 10);
                if (isNaN(index)) return;

                if (type === 'projects') {
                    const project = folderContents[type][index];
                    if (project && project.url) {
                        window.open(project.url, '_blank', 'noopener,noreferrer');
                    }
                } else {
                    openWindow(type, index);
                }
            };

            $item.on(selectEvent, handleSelection);

            $item.on('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelection(e);
                }
            });
        });
    }

    function renderFolderContent(type, fileIndex) {
        const items = folderContents[type] || [];

        if (!items.length) {
            $windowContent.html(`
                <div class="folder-content">
                    <p>Папка пока пуста.</p>
                </div>
            `);
            return;
        }

        if (Number.isInteger(fileIndex) && items[fileIndex]) {
            renderGallery(type, fileIndex);
        } else {
            renderFolder(type);
        }
    }

    function renderTextFile() {
        $windowContent.html(`
            <div class="text-content">
                <h2>About</h2>
                <p>This is a desktop interface template.</p>
                <p>Built with vanilla JavaScript, HTML, and CSS.</p>
            </div>
        `);
    }

    function renderCalls() {
        $windowContent.html('<div class="call-log"><p>No recent calls</p></div>');
    }

    function renderNotes() {
        $windowContent.html('<textarea class="notes-area" placeholder="Your notes..." aria-label="Notes textarea"></textarea>');
    }

    function renderGallery(type, startIndex) {
        startIndex = startIndex || 0;
        const items = folderContents[type] || [];
        if (!items.length) return;

        currentIndex[type] = startIndex;

        $windowContent.html(`
            <div class="gallery" role="region" aria-label="Image gallery">
                <button class="arrow left" aria-label="Previous image">&#10094;</button>
                <div class="gallery-container">
                    ${items.map((item, idx) => `
                        <div class="gallery-item${type === 'projects' ? ' gallery-item--link' : ''}" role="img" aria-label="${item.name}">
                            <img src="${item.src}" alt="${item.name}">
                        </div>
                    `).join('')}
                </div>
                <button class="arrow right" aria-label="Next image">&#10095;</button>
            </div>
        `);

        const $container = $windowContent.find('.gallery-container');
        const $leftArrow = $windowContent.find('.arrow.left');
        const $rightArrow = $windowContent.find('.arrow.right');

        const updateGallery = function() {
            $container.css('transform', `translateX(-${currentIndex[type] * 100}%)`);
            $leftArrow.attr('aria-disabled', currentIndex[type] === 0);
            $rightArrow.attr('aria-disabled', currentIndex[type] === items.length - 1);
        };

        $leftArrow.on('click', function() {
            currentIndex[type] = (currentIndex[type] - 1 + items.length) % items.length;
            updateGallery();
        });

        $rightArrow.on('click', function() {
            currentIndex[type] = (currentIndex[type] + 1) % items.length;
            updateGallery();
        });

        updateGallery();

        if (type === 'projects') {
            $windowContent.find('.gallery-item--link img').each(function(index) {
                $(this).on('click', function() {
                    if (items[index] && items[index].url) {
                        window.open(items[index].url, '_blank', 'noopener,noreferrer');
                    }
                });
            });
        }
    }

    // GitHub functions
    const buildGitHubCacheKey = function(username) {
        return CONSTANTS.GITHUB_CACHE_PREFIX + username;
    };

    function readGitHubCache(username) {
        if (!isLocalStorageAvailable) return null;
        try {
            const raw = localStorage.getItem(buildGitHubCacheKey(username));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const timestamp = parsed.timestamp;
            const data = parsed.data;
            if (!timestamp || !data) return null;
            if (Date.now() - timestamp > CONSTANTS.GITHUB_CACHE_TTL) {
                localStorage.removeItem(buildGitHubCacheKey(username));
                return null;
            }
            return data;
        } catch (error) {
            console.warn('Не удалось прочитать кэш GitHub.', error);
            return null;
        }
    }

    function writeGitHubCache(username, data) {
        if (!isLocalStorageAvailable) return;
        try {
            localStorage.setItem(buildGitHubCacheKey(username), JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (error) {
            console.warn('Не удалось записать кэш GitHub.', error);
        }
    }

    function loadGitHubProfile() {
        $windowContent.html(`
            <div class="github-profile">
                <div class="gh-profiles">
                    ${GITHUB_PROFILES.map(renderGitHubProfileSection).join("")}
                </div>
            </div>
        `);

        GITHUB_PROFILES.forEach(function(profile) {
            hydrateGitHubProfile(profile);
        });
    }

    function renderGitHubProfileSection(profile) {
        const prefix = profile.prefix;
        const username = profile.username;

        return `
            <section class="gh-profile" data-user="${username}">
                <div class="gh-body">
                    <div class="gh-left-column">
                        <img id="${prefix}-avatar" class="gh-avatar" src="" alt="Avatar ${username}" />
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

    function hydrateGitHubProfile(profile) {
        const username = profile.username;
        const prefix = profile.prefix;

        const $avatar = $('#' + prefix + '-avatar');
        const $name = $('#' + prefix + '-name');
        const $followers = $('#' + prefix + '-followers');
        const $reposList = $('#' + prefix + '-repos');
        const $readmeContainer = $('#' + prefix + '-readme');

        fetchGitHubData(username)
            .then(function(result) {
                const user = result.user;
                const repos = result.repos;
                const readme = result.readme;

                if ($avatar.length && user) {
                    $avatar.attr('src', user.avatar_url);
                    $avatar.attr('alt', 'Avatar ' + user.login);
                }

                if ($name.length) {
                    $name.text(user ? (user.name || user.login) : "Failed to load");
                }

                if ($followers.length && user) {
                    $followers.text(user.followers + ' followers · ' + user.following + ' following');
                }

                if ($reposList.length) {
                    if (repos && repos.length) {
                        $reposList.html(repos.map(function(repo) {
                            return `
                                <li>
                                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a> ⭐ ${repo.stargazers_count}
                                </li>
                            `;
                        }).join(""));
                    } else {
                        $reposList.text("No public repositories.");
                    }
                }

                if ($readmeContainer.length) {
                    if (readme && typeof DOMPurify !== 'undefined' && typeof marked !== 'undefined') {
                        const parsed = marked.parse(readme);
                        const sanitized = DOMPurify.sanitize(parsed);
                        $readmeContainer.html(sanitized);
                    } else if (readme) {
                        $readmeContainer.text(readme);
                    } else {
                        $readmeContainer.text("No README found.");
                    }
                }
            })
            .catch(function(error) {
                const isRateLimit = Boolean(error && error.isRateLimit);

                if ($name.length) {
                    $name.text(isRateLimit ? 'Лимит GitHub API' : 'Failed to load');
                }

                if ($followers.length) {
                    $followers.text('');
                }

                if ($reposList.length) {
                    if (isRateLimit) {
                        $reposList.html(`
                            <li>
                                <span>${GITHUB_RATE_LIMIT_MESSAGE}</span><br>
                                <a href="https://github.com/${username}" target="_blank" rel="noopener noreferrer">Открыть профиль ${username}</a>
                            </li>
                        `);
                    } else {
                        $reposList.text('Failed to load repos.');
                    }
                }

                if ($readmeContainer.length) {
                    $readmeContainer.text(isRateLimit ? GITHUB_RATE_LIMIT_MESSAGE : 'No README found.');
                }

                console.error('GitHub profile error:', error);
            });
    }

    function fetchGitHubData(username) {
        if (!githubDataCache[username] || githubDataCache[username].pending) {
            const cached = readGitHubCache(username);

            if (cached) {
                githubDataCache[username] = { data: Promise.resolve(cached), pending: false };

                setTimeout(function() {
                    refreshGitHubData(username)
                        .then(function(freshData) {
                            githubDataCache[username] = { data: Promise.resolve(freshData), pending: false };
                        })
                        .catch(function(error) {
                            if (!(error && error.isRateLimit)) {
                                console.warn('Не удалось обновить данные GitHub для ' + username, error);
                            }
                        });
                }, 100);
            } else {
                githubDataCache[username] = { data: refreshGitHubData(username), pending: true };
                githubDataCache[username].data.finally(function() {
                    githubDataCache[username].pending = false;
                });
            }
        }

        return githubDataCache[username].data;
    }

    function refreshGitHubData(username) {
        return Promise.all([
            fetchGitHubUser(username),
            fetchGitHubRepos(username).catch(function(error) {
                if (error && error.isRateLimit) throw error;
                return [];
            }),
            fetchUserReadme(username).catch(function(error) {
                if (error && error.isRateLimit) throw error;
                return null;
            })
        ])
            .then(function(results) {
                const payload = {
                    user: results[0],
                    repos: results[1],
                    readme: results[2]
                };
                writeGitHubCache(username, payload);
                return payload;
            })
            .catch(function(error) {
                if (githubDataCache[username]) {
                    delete githubDataCache[username];
                }
                throw error;
            });
    }

    async function fetchGitHubResource(url, options) {
        options = options || {};
        const responseType = options.responseType || 'json';

        try {
            const response = await fetch(url, { headers: GITHUB_REQUEST_HEADERS });

            if (response.status === 403) {
                let message = 'GitHub API rate limit exceeded';
                try {
                    const body = await response.json();
                    if (body && body.message) {
                        message = body.message;
                    }
                } catch (error) {
                    console.warn('Не удалось разобрать тело ответа GitHub при 403.', error);
                }

                const rateLimitError = new Error(message);
                rateLimitError.isRateLimit = true;
                rateLimitError.status = 403;
                throw rateLimitError;
            }

            if (!response.ok) {
                const text = await response.text().catch(function() { return ''; });
                const error = new Error(text || response.statusText);
                error.status = response.status;
                throw error;
            }

            if (responseType === 'text') {
                return response.text();
            }

            if (responseType === 'json') {
                return response.json();
            }

            return response;
        } catch (error) {
            if (error.isRateLimit) throw error;
            console.error('GitHub fetch error for ' + url + ':', error);
            throw error;
        }
    }

    function fetchGitHubUser(username) {
        return fetchGitHubResource('https://api.github.com/users/' + username);
    }

    function fetchGitHubRepos(username) {
        return fetchGitHubResource('https://api.github.com/users/' + username + '/repos?sort=updated&per_page=5')
            .then(function(repos) {
                if (!Array.isArray(repos)) throw new Error("Invalid repos response");
                return repos;
            });
    }

    function fetchUserReadme(username) {
        const readmePaths = [
            'https://raw.githubusercontent.com/' + username + '/' + username + '/main/README.md',
            'https://raw.githubusercontent.com/' + username + '/' + username + '/master/README.md',
            'https://raw.githubusercontent.com/' + username + '/profile/main/README.md'
        ];

        const tryFetch = async function(index) {
            index = index || 0;

            if (index >= readmePaths.length) {
                throw new Error("README not found");
            }

            try {
                const response = await fetch(readmePaths[index]);
                if (response.status === 403) {
                    const rateLimitError = new Error('GitHub raw rate limit');
                    rateLimitError.isRateLimit = true;
                    rateLimitError.status = 403;
                    throw rateLimitError;
                }

                if (!response.ok) {
                    throw new Error("Not found");
                }

                return await response.text();
            } catch (error) {
                if (error && error.isRateLimit) throw error;
                return tryFetch(index + 1);
            }
        };

        return tryFetch();
    }

    // Telegram
    function renderTelegram() {
        $windowContent.html(`
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
        `);

        const $chatList = $('#telegram-chat-list');
        const $messagesContainer = $('#telegram-messages');
        const $input = $('#telegram-input');
        const $sendBtn = $('#telegram-send');

        if (!telegramState.chats.length) {
            telegramState.chats.push({
                id: Date.now(),
                name: 'New chat',
                avatar: 'photos/photo1.jpg',
                messages: []
            });
        }

        if (!telegramState.activeChatId) {
            telegramState.activeChatId = telegramState.chats[0].id;
        }

        const findChat = function(id) {
            return telegramState.chats.find(function(chat) {
                return chat.id === id;
            });
        };

        const renderChatList = function() {
            $chatList.html(telegramState.chats.map(function(chat) {
                return `
                    <div class="telegram-chat-item${chat.id === telegramState.activeChatId ? ' is-active' : ''}"
                         data-id="${chat.id}"
                         role="listitem"
                         tabindex="0"
                         aria-label="Chat with ${chat.name}">
                        <img src="${chat.avatar}" alt="">
                        <span>${chat.name}</span>
                    </div>
                `;
            }).join(''));

            $chatList.find('.telegram-chat-item').each(function() {
                $(this).on('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        $(this).trigger('click');
                    }
                });
            });
        };

        const renderMessages = function() {
            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;

            $messagesContainer.html(chat.messages.map(function(msg) {
                return `<div class="telegram-message ${msg.type}" role="article">${msg.text}</div>`;
            }).join(''));

            $messagesContainer.scrollTop($messagesContainer[0].scrollHeight);
        };

        $chatList.on('click', function(e) {
            const $item = $(e.target).closest('.telegram-chat-item');
            if (!$item.length) return;

            const nextId = parseInt($item.data('id'), 10);
            if (isNaN(nextId)) return;

            telegramState.activeChatId = nextId;
            renderChatList();
            renderMessages();
        });

        const sendMessage = function() {
            const text = $input.val().trim();
            if (!text) return;

            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;

            chat.messages.push({ type: 'sent', text: text });
            $input.val('');
            renderMessages();
        };

        $sendBtn.on('click', sendMessage);

        $input.on('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });

        renderChatList();
        renderMessages();
    }

    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        if (dateTimerId !== null) {
            clearInterval(dateTimerId);
            dateTimerId = null;
        }
    });

    // Start the app
    init();
});
