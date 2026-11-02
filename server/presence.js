// server/presence.js

// ルームを前面で見ている端末（clientId）を管理する。通知の宛先から外すために使う。
export function createPresence() {
  const entries = new Map(); // socketId -> { roomId, clientId, visible }

  return {
    set({ socketId, roomId, clientId, visible }) {
      entries.set(socketId, { roomId, clientId, visible: visible === true });
    },

    remove(socketId) {
      entries.delete(socketId);
    },

    // 同じ clientId の接続のどれかが前面なら、その端末は前面表示中とみなす。
    visibleClientIds(roomId) {
      const ids = new Set();
      for (const entry of entries.values()) {
        if (entry.roomId === roomId && entry.visible) ids.add(entry.clientId);
      }
      return ids;
    },
  };
}
