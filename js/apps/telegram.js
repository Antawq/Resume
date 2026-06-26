import { telegramState } from "../state.js";
import { escapeHtml } from "../utils.js";
import photo1 from "../../photos/photo1.webp";

export function renderTelegram(windowContent) {
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
      avatar: photo1,
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

  // --- Chat list ---

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

  // --- Messages ---

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

  // --- Send ---

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
