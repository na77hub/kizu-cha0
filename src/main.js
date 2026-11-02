// src/main.js
import { getOrCreateClientId } from "./client-id.js";
import { disablePush, enablePush, isPushEnabled } from "./push.js";
import { getRoomIdFromUrl } from "./room.js";
import { connectSocket, emitWithAck } from "./socket.js";

const roomId = getRoomIdFromUrl();
const socket = connectSocket({ roomId, clientId: getOrCreateClientId() });

async function renderPushStatus() {
  document.querySelector("#push-status").textContent = `Web Push:${await isPushEnabled()}`;
}

function onClick(selector, handler) {
  document.querySelector(selector).addEventListener("click", handler);
}

document.querySelector("#room-label").textContent = `Room:${roomId}`;
renderPushStatus();

onClick("#subscribe-button", async () => {
  await enablePush(socket);
  await renderPushStatus();
});
onClick("#unsubscribe-button", async () => {
  await disablePush(socket);
  await renderPushStatus();
});
// チャット機能（chat:post）で置き換える予定の暫定動作。
onClick("#send-button", () => {
  emitWithAck(socket, "push:send", { body: "こんにちは、kizu-cha ZEROです！" });
});
