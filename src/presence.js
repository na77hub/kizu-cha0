// src/presence.js

// ページが前面で見えているかをサーバへ伝える。前面表示中は Web Push の通知を受けない。
export function startPresence(socket) {
  const send = () =>
    socket.emit("presence:update", { visible: document.visibilityState === "visible" });

  socket.on("connect", send);
  document.addEventListener("visibilitychange", send);
}
