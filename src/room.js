// src/room.js

// URL の /kc/<roomId>/ から roomId を取り出す。
export function getRoomIdFromUrl() {
  const segments = new URL(window.location).pathname.split("/");
  return segments[segments.indexOf("kc") + 1];
}
