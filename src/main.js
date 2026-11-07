// src/main.js
import { startChat } from "./chat.js";
import { getOrCreateClientId } from "./client-id.js";
import { startPresence } from "./presence.js";
import { disablePush, enablePush, isPushEnabled } from "./push.js";
import { getRoomIdFromUrl } from "./room.js";
import { connectSocket } from "./socket.js";

const roomId = getRoomIdFromUrl();
const clientId = getOrCreateClientId();
const socket = connectSocket({ roomId, clientId });

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

startChat(socket, { clientId });
startPresence(socket);
