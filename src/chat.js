// src/chat.js
import { emitWithAck } from "./socket.js";

const NAME_STORAGE_KEY = "kizu-cha-name";
const MAX_DISPLAYED_MESSAGES = 1000;
const ERROR_LABELS = {
  invalid_body: "メッセージは1〜500文字で入力してください。",
  invalid_name: "表示名は1〜20文字で入力してください。",
  rate_limited: "投稿が多すぎます。少し待ってください。",
};

function loadName(clientId) {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || `ゲスト${clientId.slice(0, 4)}`;
  } catch {
    return `ゲスト${clientId.slice(0, 4)}`;
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // 保存できなくても動作には影響しない
  }
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function startChat(socket, { clientId }) {
  const list = document.querySelector("#chat-messages");
  const status = document.querySelector("#chat-status");
  const form = document.querySelector("#chat-form");
  const nameInput = document.querySelector("#chat-name");
  const bodyInput = document.querySelector("#chat-body");
  const sendButton = document.querySelector("#chat-send");

  const messages = new Map(); // id -> message
  let mySenderId = null;

  nameInput.value = loadName(clientId);

  function createItem(message) {
    const item = document.createElement("li");
    item.classList.toggle("mine", message.senderId === mySenderId);

    // senderId から決まる色で、同名の別人を見分けられるようにする。
    const hue = parseInt(message.senderId.slice(0, 4), 16) % 360;
    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const name = document.createElement("span");
    name.className = "chat-name";
    name.style.color = `hsl(${hue} 60% 35%)`;
    name.textContent = message.name;

    meta.append(name, ` #${message.senderId.slice(0, 4)} ${formatTime(message.createdAt)}`);

    const body = document.createElement("div");
    body.className = "chat-body";
    body.textContent = message.body;

    item.append(meta, body);
    return item;
  }

  function sortedMessages() {
    return [...messages.values()].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
  }

  function render() {
    const stickToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    const shown = sortedMessages().slice(-MAX_DISPLAYED_MESSAGES);
    messages.clear();
    shown.forEach((message) => messages.set(message.id, message));
    list.replaceChildren(...shown.map(createItem));
    if (stickToBottom) list.scrollTop = list.scrollHeight;
  }

  // 履歴とリアルタイム配信が重なっても、id で重複を除いて合流させる。
  function addMessages(incoming) {
    let added = false;
    for (const message of incoming) {
      if (!messages.has(message.id)) {
        messages.set(message.id, message);
        added = true;
      }
    }
    if (added) render();
  }

  socket.on("session:ready", ({ senderId }) => {
    mySenderId = senderId;
  });
  socket.on("chat:history", addMessages);
  socket.on("chat:message", (message) => addMessages([message]));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const body = bodyInput.value.trim();
    if (!name || !body) return;

    saveName(name);
    sendButton.disabled = true;
    status.textContent = "送信中...";
    try {
      const result = await emitWithAck(socket, "chat:post", { body, name });
      if (result.ok) {
        bodyInput.value = "";
        status.textContent = "";
      } else {
        status.textContent = ERROR_LABELS[result.error] ?? "送信に失敗しました。";
      }
    } catch {
      status.textContent = "送信に失敗しました。接続を確認してください。";
    } finally {
      sendButton.disabled = false;
      bodyInput.focus();
    }
  });
}
