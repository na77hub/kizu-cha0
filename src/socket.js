// src/socket.js
import { io } from "socket.io-client";

const ACK_TIMEOUT_MS = 5000;

export function connectSocket({ roomId, clientId }) {
  const socket = io(window.location.origin, { query: { roomId, clientId } });
  socket.on("session:ready", () => console.log("socket.io 接続済"));
  socket.on("connect_error", (error) => console.error("socket.io 接続エラー:", error.message));
  return socket;
}

// イベントを送り、サーバの確認応答（{ ok, error? }）を待つ。
export async function emitWithAck(socket, eventName, payload) {
  const result = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(eventName, payload);
  if (!result.ok) console.warn(`${eventName} が失敗しました:`, result.error);
  return result;
}
